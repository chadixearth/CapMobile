# Django Tartanilla Carriages Setup Guide

## 1. Create the ViewSet

Create or update your `views.py` file:

```python
# views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from tartanilla_admin.supabase import supabase
from datetime import datetime
import traceback
import json
import uuid

class TartanillaCarriageViewSet(viewsets.ViewSet):
    """ViewSet for tartanilla carriages (full CRUD operations)"""
    permission_classes = [AllowAny]

    def list(self, request):
        """Get all tartanilla carriages"""
        try:
            # Get all carriages
            response = supabase.table('tartanilla_carriages').select('*').execute()
            carriages = response.data if hasattr(response, 'data') else []

            # Get owner and driver information for each carriage
            for carriage in carriages:
                # Get owner info
                if carriage.get('assigned_owner_id'):
                    owner_response = supabase.table('users').select('id, name, email, role').eq('id', carriage['assigned_owner_id']).execute()
                    if hasattr(owner_response, 'data') and owner_response.data:
                        carriage['assigned_owner'] = owner_response.data[0]

                # Get driver info
                if carriage.get('assigned_driver_id'):
                    driver_response = supabase.table('users').select('id, name, email, role').eq('id', carriage['assigned_driver_id']).execute()
                    if hasattr(driver_response, 'data') and driver_response.data:
                        carriage['assigned_driver'] = driver_response.data[0]

            return Response({
                'success': True,
                'data': carriages
            })

        except Exception as e:
            print(f'Error fetching carriages: {str(e)}')
            print(f'Traceback: {traceback.format_exc()}')
            return Response({
                'success': False,
                'error': 'Failed to fetch carriages',
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """Create a new tartanilla carriage"""
        try:
            data = request.data

            # Validate required fields
            required_fields = ['plate_number', 'assigned_owner_id']
            for field in required_fields:
                if not data.get(field):
                    return Response({
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Validate that the owner exists and has the correct role
            owner_response = supabase.table('users').select('id, role').eq('id', data['assigned_owner_id']).execute()
            if not hasattr(owner_response, 'data') or not owner_response.data:
                return Response({
                    'success': False,
                    'error': 'Owner not found'
                }, status=status.HTTP_400_BAD_REQUEST)

            owner_data = owner_response.data[0]
            if owner_data['role'] != 'owner':
                return Response({
                    'success': False,
                    'error': 'User must be an owner to create tartanilla carriages'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check if plate number already exists
            existing_response = supabase.table('tartanilla_carriages').select('id').eq('plate_number', data['plate_number']).execute()
            if hasattr(existing_response, 'data') and existing_response.data:
                return Response({
                    'success': False,
                    'error': 'Plate number already exists'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Prepare carriage data
            carriage_data = {
                'id': str(uuid.uuid4()),
                'plate_number': data.get('plate_number'),
                'assigned_owner_id': data.get('assigned_owner_id'),
                'capacity': data.get('capacity', 4),
                'status': data.get('status', 'available'),
                'eligibility': data.get('eligibility', 'eligible'),
                'notes': data.get('notes'),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }

            # Remove None values
            carriage_data = {k: v for k, v in carriage_data.items() if v is not None}

            # Insert into database
            response = supabase.table('tartanilla_carriages').insert(carriage_data).execute()

            if hasattr(response, 'data') and response.data:
                return Response({
                    'success': True,
                    'data': response.data[0],
                    'message': 'Tartanilla carriage created successfully'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': 'Failed to create tartanilla carriage'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            print(f'Error creating carriage: {str(e)}')
            print(f'Traceback: {traceback.format_exc()}')
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def get_by_owner(self, request):
        """Get tartanilla carriages for a specific owner"""
        try:
            owner_id = request.query_params.get('owner_id')

            if not owner_id:
                return Response({
                    'success': False,
                    'error': 'Owner ID is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get carriages for this owner
            response = supabase.table('tartanilla_carriages').select('*').eq('assigned_owner_id', owner_id).execute()
            carriages = response.data if hasattr(response, 'data') else []

            # Get owner and driver information for each carriage
            for carriage in carriages:
                # Get owner info
                if carriage.get('assigned_owner_id'):
                    owner_response = supabase.table('users').select('id, name, email, role').eq('id', carriage['assigned_owner_id']).execute()
                    if hasattr(owner_response, 'data') and owner_response.data:
                        carriage['assigned_owner'] = owner_response.data[0]

                # Get driver info
                if carriage.get('assigned_driver_id'):
                    driver_response = supabase.table('users').select('id, name, email, role').eq('id', carriage['assigned_driver_id']).execute()
                    if hasattr(driver_response, 'data') and driver_response.data:
                        carriage['assigned_driver'] = driver_response.data[0]

            return Response({
                'success': True,
                'data': carriages
            })

        except Exception as e:
            print(f'Error fetching carriages for owner {owner_id}: {str(e)}')
            print(f'Traceback: {traceback.format_exc()}')
            return Response({
                'success': False,
                'error': 'Failed to fetch carriages for owner',
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

## 2. Configure URLs

Create or update your `urls.py` file:

```python
# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TartanillaCarriageViewSet

router = DefaultRouter()
router.register(r'tartanilla-carriages', TartanillaCarriageViewSet, basename='tartanilla-carriages')

urlpatterns = [
    path('api/', include(router.urls)),
    # ... your other URL patterns
]
```

## 3. Update Main URLs

Make sure your main `urls.py` includes your app URLs:

```python
# main urls.py (project level)
from django.urls import path, include

urlpatterns = [
    path('', include('your_app_name.urls')),
    # ... other patterns
]
```

## 4. Install Required Dependencies

Make sure you have the required packages:

```bash
pip install djangorestframework supabase
```

## 5. Test the Endpoint

After setting this up:

1. Restart your Django server
2. Test the endpoint: `http://192.168.1.8:8000/api/tartanilla-carriages/`
3. Use the "Test" button in the mobile app

## 6. Expected API Endpoints

Once configured, you should have these endpoints:

- `GET /api/tartanilla-carriages/` - List all carriages
- `POST /api/tartanilla-carriages/` - Create new carriage
- `GET /api/tartanilla-carriages/get_by_owner/?owner_id=123` - Get carriages by owner

## 7. Database Schema

Make sure your Supabase database has a `tartanilla_carriages` table with these columns:

- `id` (UUID, primary key)
- `plate_number` (text, unique)
- `assigned_owner_id` (UUID, foreign key to users)
- `assigned_driver_id` (UUID, foreign key to users, nullable)
- `capacity` (integer)
- `status` (text)
- `eligibility` (text)
- `notes` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)
