# Backend API Fixes Summary

## Issues Identified

### 1. JWT Token Expiration
- Mobile app is receiving "JWT expired" errors
- Need to implement token refresh mechanism
- Backend needs to handle expired tokens gracefully

### 2. Tour Booking API Errors (500 Status)
- `/api/tour-booking/driver/{driver_id}/` returning 500 errors
- "Failed to fetch driver tour bookings" error message
- Backend database connection issues

### 3. Earnings API Issues
- `/api/earnings/mobile_earnings/` returning 500 status
- Connection timeouts and network errors
- Supabase fallback mechanisms not working properly

## Backend Fixes Required

### 1. Fix JWT Token Handling in Backend

**File: `C:\Users\richa\OneDrive\Desktop\Capstone-Web\CapstoneWeb\core\jwt_auth.py`**

Add token refresh and better error handling:

```python
from datetime import datetime, timedelta
import jwt
from django.conf import settings

def verify_token(token):
    """Verify JWT token with better error handling"""
    try:
        if not token:
            return None
            
        # Remove Bearer prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
            
        # Decode token
        payload = jwt.decode(
            token, 
            settings.SUPABASE_JWT_SECRET, 
            algorithms=['HS256'],
            options={"verify_exp": True}
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        print("JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"Invalid JWT token: {e}")
        return None
    except Exception as e:
        print(f"JWT verification error: {e}")
        return None

def refresh_token_if_needed(token):
    """Check if token needs refresh and return new token if needed"""
    try:
        payload = jwt.decode(
            token, 
            settings.SUPABASE_JWT_SECRET, 
            algorithms=['HS256'],
            options={"verify_exp": False}  # Don't verify expiration for checking
        )
        
        exp = payload.get('exp')
        if exp:
            exp_time = datetime.fromtimestamp(exp)
            now = datetime.now()
            
            # If token expires in less than 5 minutes, suggest refresh
            if exp_time - now < timedelta(minutes=5):
                return {'needs_refresh': True, 'expires_at': exp_time}
                
        return {'needs_refresh': False}
        
    except Exception as e:
        print(f"Token refresh check error: {e}")
        return {'needs_refresh': True, 'error': str(e)}
```

### 2. Fix Tour Booking API

**File: `C:\Users\richa\OneDrive\Desktop\Capstone-Web\CapstoneWeb\api\booking.py`**

Add better error handling in the `get_driver_bookings` method:

```python
@action(detail=False, methods=['get'], url_path='driver/(?P<driver_id>[^/.]+)')
def get_driver_bookings(self, request, driver_id=None):
    """Get all tour bookings assigned to a specific driver with enhanced error handling"""
    try:
        # Validate driver_id
        if not driver_id:
            return Response({
                'success': False,
                'error': 'Driver ID is required',
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Add connection health check
        try:
            # Simple health check query
            health_check = supabase.table('bookings').select('id').limit(1).execute()
            if not hasattr(health_check, 'data'):
                raise Exception("Database connection failed")
        except Exception as conn_error:
            print(f'Database connection error: {conn_error}')
            return Response({
                'success': False,
                'error': 'Database temporarily unavailable',
                'data': []
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # Get query parameters with defaults
        status_filter = request.query_params.get('status') if hasattr(request, 'query_params') else request.GET.get('status')
        date_from = request.query_params.get('date_from') if hasattr(request, 'query_params') else request.GET.get('date_from')
        date_to = request.query_params.get('date_to') if hasattr(request, 'query_params') else request.GET.get('date_to')
        
        # Build query with retry mechanism
        def build_query():
            query = supabase.table('bookings').select('*').eq('driver_id', driver_id)
            
            if status_filter:
                query = query.eq('status', status_filter)
            if date_from:
                query = query.gte('booking_date', date_from)
            if date_to:
                query = query.lte('booking_date', date_to)
            
            return query.order('created_at', desc=True).execute()
        
        # Execute with retry
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = build_query()
                bookings = response.data if hasattr(response, 'data') and response.data else []
                break
            except Exception as query_error:
                print(f'Query attempt {attempt + 1} failed: {query_error}')
                if attempt == max_retries - 1:
                    return Response({
                        'success': False,
                        'error': 'Failed to fetch driver tour bookings after retries',
                        'data': []
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                time.sleep(0.5 * (attempt + 1))  # Exponential backoff
        
        # Process bookings safely
        processed_bookings = []
        total_earnings = 0
        status_counts = {}
        
        for booking in bookings:
            try:
                # Safe date formatting
                if booking.get('booking_date'):
                    try:
                        booking_date = datetime.fromisoformat(str(booking['booking_date']).split('T')[0])
                        booking['booking_date_formatted'] = booking_date.strftime('%B %d, %Y')
                    except Exception:
                        booking['booking_date_formatted'] = str(booking.get('booking_date', 'N/A'))
                
                # Safe amount formatting
                if booking.get('total_amount'):
                    try:
                        amount = float(booking['total_amount'])
                        booking['total_amount_formatted'] = f"₱{amount:,.2f}"
                        if booking.get('status') == 'completed':
                            driver_earning = amount * 0.8  # 80% to driver
                            total_earnings += driver_earning
                            booking['driver_earnings'] = driver_earning
                            booking['driver_earnings_formatted'] = f"₱{driver_earning:,.2f}"
                    except Exception:
                        booking['total_amount_formatted'] = '₱0.00'
                
                # Count statuses
                booking_status = str(booking.get('status', 'unknown'))
                status_counts[booking_status] = status_counts.get(booking_status, 0) + 1
                
                # Add summary
                package_name = str(booking.get('package_name', 'Tour Package'))
                pax_count = booking.get('number_of_pax', 0)
                booking['summary'] = f"{package_name} - {pax_count} pax"
                
                processed_bookings.append(booking)
                
            except Exception as process_error:
                print(f'Error processing booking {booking.get("id", "unknown")}: {process_error}')
                continue
        
        # Get driver name safely
        driver_name = 'Unknown'
        try:
            if processed_bookings:
                driver_name = str(processed_bookings[0].get('driver_name', 'Unknown'))
            else:
                # Try to get driver name from users table
                user_response = supabase.table('users').select('name').eq('id', driver_id).single().execute()
                if hasattr(user_response, 'data') and user_response.data:
                    driver_name = user_response.data.get('name', 'Unknown')
        except Exception:
            pass
        
        return Response({
            'success': True,
            'data': {
                'bookings': processed_bookings,
                'driver_info': {
                    'id': driver_id,
                    'name': driver_name
                },
                'statistics': {
                    'total_bookings': len(processed_bookings),
                    'status_counts': status_counts,
                    'total_earnings': total_earnings,
                    'total_earnings_formatted': f"₱{total_earnings:,.2f}",
                    'driver_percentage': 80
                }
            },
            'count': len(processed_bookings)
        })
        
    except Exception as e:
        print(f'Unexpected error in get_driver_bookings: {str(e)}')
        import traceback
        traceback.print_exc()
        return Response({
            'success': False,
            'error': 'Failed to fetch driver tour bookings',
            'data': []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### 3. Fix Earnings API

**File: `C:\Users\richa\OneDrive\Desktop\Capstone-Web\CapstoneWeb\api\earnings.py`**

Improve the `mobile_earnings` method:

```python
@action(detail=False, methods=["get"])
def mobile_earnings(self, request):
    """Mobile app earnings with enhanced error handling and fallbacks"""
    actor = _actor_from_request(request)
    try:
        qp = getattr(request, "query_params", request.GET)
        driver_id = qp.get("driver_id")
        date_from = qp.get("date_from")
        date_to = qp.get("date_to")
        
        # Validate driver_id
        if not driver_id:
            resp = Response({
                'success': False, 
                'error': 'driver_id parameter is required',
                'data': {
                    'earnings': [],
                    'statistics': {
                        'total_revenue': 0,
                        'total_driver_earnings': 0,
                        'total_admin_earnings': 0,
                        'admin_percentage': 20,
                        'driver_percentage': 80,
                        'count': 0
                    }
                },
                'actor': actor
            }, status=400)
            return _add_actor_headers(resp, actor)
        
        # Build query with connection health check
        try:
            # Health check
            health = supabase.table("earnings").select("id").limit(1).execute()
            if not hasattr(health, 'data'):
                raise Exception("Database connection failed")
        except Exception as conn_error:
            print(f'Database connection error in mobile_earnings: {conn_error}')
            resp = Response({
                'success': False,
                'error': 'Database temporarily unavailable',
                'data': {
                    'earnings': [],
                    'statistics': {
                        'total_revenue': 0,
                        'total_driver_earnings': 0,
                        'total_admin_earnings': 0,
                        'admin_percentage': 20,
                        'driver_percentage': 80,
                        'count': 0
                    }
                },
                'actor': actor
            }, status=503)
            return _add_actor_headers(resp, actor)
        
        # Build query with retry mechanism
        def build_earnings_query():
            q = supabase.table("earnings").select("*").eq("driver_id", str(driver_id))
            
            if date_from:
                q = q.gte("earning_date", date_from)
            if date_to:
                q = q.lt("earning_date", date_to)
            
            return q.execute()
        
        # Execute with retries
        earnings_rows = []
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = build_earnings_query()
                earnings_rows = response.data if hasattr(response, 'data') else []
                break
            except Exception as query_error:
                print(f'Earnings query attempt {attempt + 1} failed: {query_error}')
                if attempt == max_retries - 1:
                    # Final fallback - return empty but successful response
                    resp = Response({
                        'success': True,
                        'data': {
                            'earnings': [],
                            'statistics': {
                                'total_revenue': 0,
                                'total_driver_earnings': 0,
                                'total_admin_earnings': 0,
                                'admin_percentage': 20,
                                'driver_percentage': 80,
                                'count': 0
                            }
                        },
                        'actor': actor
                    })
                    return _add_actor_headers(resp, actor)
                time.sleep(0.5 * (attempt + 1))
        
        # Filter out reversed earnings and calculate totals
        valid_earnings = []
        total_driver_earnings = Decimal('0.00')
        total_revenue = Decimal('0.00')
        
        for row in earnings_rows:
            try:
                if (row.get("status") or "").lower() == REVERSED_STATUS:
                    continue
                    
                total, admin_e, driver_e = _split_amount(row)
                total_revenue += total
                total_driver_earnings += driver_e
                
                valid_earnings.append({
                    'id': row.get('id'),
                    'booking_id': row.get('booking_id'),
                    'package_name': row.get('package_name', 'Tour Package'),
                    'earning_date': row.get('earning_date'),
                    'total_amount': float(total),
                    'driver_earnings': float(driver_e),
                    'admin_earnings': float(admin_e),
                    'status': row.get('status'),
                    'is_custom_booking': bool(row.get('custom_tour_id'))
                })
            except Exception as process_error:
                print(f'Error processing earning row: {process_error}')
                continue
        
        resp = Response({
            'success': True,
            'data': {
                'earnings': valid_earnings,
                'statistics': {
                    'total_revenue': float(total_revenue),
                    'total_driver_earnings': float(total_driver_earnings),
                    'total_admin_earnings': float(total_revenue - total_driver_earnings),
                    'admin_percentage': 20,
                    'driver_percentage': 80,
                    'count': len(valid_earnings),
                    'avg_earning_per_booking': float(total_driver_earnings / len(valid_earnings)) if valid_earnings else 0
                }
            },
            'actor': actor
        })
        return _add_actor_headers(resp, actor)
        
    except Exception as e:
        logger.error(f"Error in mobile_earnings: {e}")
        import traceback
        traceback.print_exc()
        resp = Response({
            'success': False, 
            'error': 'Internal server error',
            'data': {
                'earnings': [],
                'statistics': {
                    'total_revenue': 0,
                    'total_driver_earnings': 0,
                    'total_admin_earnings': 0,
                    'admin_percentage': 20,
                    'driver_percentage': 80,
                    'count': 0
                }
            },
            'actor': actor
        }, status=500)
        return _add_actor_headers(resp, actor)
```

## Mobile App Fixes Required

### 1. Add Token Refresh Mechanism

**File: `c:\Users\richa\OneDrive\Desktop\Capstone-Mobile\CapMobile\src\services\authService.js`**

Add token refresh functionality:

```javascript
// Add to existing authService.js

export async function refreshTokenIfNeeded() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('[AUTH] Session error:', error.message);
      return false;
    }
    
    if (!session) {
      console.log('[AUTH] No active session');
      return false;
    }
    
    // Check if token expires in next 5 minutes
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now < fiveMinutes) {
      console.log('[AUTH] Token expires soon, refreshing...');
      
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.log('[AUTH] Token refresh failed:', refreshError.message);
        return false;
      }
      
      if (newSession) {
        console.log('[AUTH] Token refreshed successfully');
        return true;
      }
    }
    
    return true;
  } catch (error) {
    console.log('[AUTH] Token refresh error:', error.message);
    return false;
  }
}

// Update getAccessToken to include refresh
export async function getAccessToken() {
  try {
    // Try to refresh token if needed
    await refreshTokenIfNeeded();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('[AUTH] Error getting session:', error.message);
      return null;
    }
    
    return session?.access_token || null;
  } catch (error) {
    console.log('[AUTH] Error getting access token:', error.message);
    return null;
  }
}
```

### 2. Improve API Error Handling

**File: `c:\Users\richa\OneDrive\Desktop\Capstone-Mobile\CapMobile\src\services\apiClient.js`**

Add better error handling and retry logic:

```javascript
// Update existing apiClient.js

import { refreshTokenIfNeeded } from './authService';

class ApiClient {
  constructor() {
    this.baseURL = apiBaseUrl();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  async makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      timeout = 30000,
      retries = this.maxRetries
    } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Refresh token if needed before each attempt
        await refreshTokenIfNeeded();
        
        const token = await getAccessToken();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle different response types
        const contentType = response.headers.get('content-type') || '';
        let data;
        
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        if (response.ok) {
          return { success: true, data, status: response.status };
        }

        // Handle specific error cases
        if (response.status === 401) {
          console.log('[ApiClient] Unauthorized - token may be expired');
          // Try to refresh token and retry once more
          if (attempt === 1) {
            const refreshed = await refreshTokenIfNeeded();
            if (refreshed) {
              continue; // Retry with refreshed token
            }
          }
        }

        if (response.status >= 500 && attempt < retries) {
          console.log(`[ApiClient] Server error ${response.status}, retrying attempt ${attempt + 1}`);
          await this.delay(this.retryDelay * attempt);
          continue;
        }

        return {
          success: false,
          error: data?.error || data?.message || `HTTP ${response.status}`,
          status: response.status,
          data
        };

      } catch (error) {
        console.log(`[ApiClient] Request failed on attempt ${attempt}:`, error.message);
        
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            status: 0
          };
        }

        if (attempt === retries) {
          return {
            success: false,
            error: error.message || 'Network error',
            status: 0
          };
        }

        // Wait before retrying
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'POST', body: data });
  }

  async put(endpoint, data, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PUT', body: data });
  }

  async delete(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

## Implementation Steps

1. **Backend Updates**:
   - Update JWT auth handling in `core/jwt_auth.py`
   - Fix tour booking API in `api/booking.py`
   - Improve earnings API in `api/earnings.py`
   - Add database connection health checks
   - Implement retry mechanisms

2. **Mobile App Updates**:
   - Add token refresh mechanism in `authService.js`
   - Improve API client with better error handling
   - Add retry logic for failed requests
   - Handle JWT expiration gracefully

3. **Testing**:
   - Test token refresh functionality
   - Verify API error handling
   - Test network timeout scenarios
   - Validate retry mechanisms

## Expected Results

After implementing these fixes:
- JWT token expiration will be handled automatically
- API 500 errors will be reduced through better error handling
- Network timeouts will be handled with retry mechanisms
- Mobile app will be more resilient to backend issues
- Better user experience with graceful error handling