// services/Earnings/BreakevenHistoryFixer.js
import { supabase } from '../supabase';
import { getTotalDriverEarnings } from './BreakevenService';

/**
 * Fix breakeven history records that have zero or null revenue_driver
 * This function will recalculate revenue for existing records
 */
export async function fixBreakevenHistoryRevenue(driverId, periodType = 'daily', limit = 10) {
  try {
    console.log(`[BreakevenHistoryFixer] Starting revenue fix for driver ${driverId}, period: ${periodType}`);
    
    // Get records with zero or null revenue_driver
    const { data: records, error: fetchError } = await supabase
      .from('breakeven_history')
      .select('*')
      .eq('driver_id', driverId)
      .eq('period_type', periodType)
      .or('revenue_driver.is.null,revenue_driver.eq.0')
      .order('period_start', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching records to fix:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!records || records.length === 0) {
      console.log('No records found that need revenue fixing');
      return { success: true, fixed: 0 };
    }

    console.log(`Found ${records.length} records that need revenue fixing`);

    let fixedCount = 0;
    
    for (const record of records) {
      try {
        // Calculate the period for earnings lookup
        let period;
        if (record.period_type === 'daily') {
          period = 'today';
        } else if (record.period_type === 'weekly') {
          period = 'week';
        } else if (record.period_type === 'monthly') {
          period = 'month';
        } else {
          continue;
        }

        // Get earnings for the specific period
        const earningsRes = await getTotalDriverEarnings(driverId, period);
        
        if (earningsRes?.success && earningsRes.data.total_earnings > 0) {
          const revenue = Number(earningsRes.data.total_earnings || 0);
          const expenses = Number(record.expenses || 0);
          const profit = Number((revenue - expenses).toFixed(2));
          
          const breakdown = {
            standard_share: Number(earningsRes.data.standard_earnings || 0),
            ride_hailing_share: Number(earningsRes.data.ride_hailing_earnings || 0),
          };

          // Update the record
          const { error: updateError } = await supabase
            .from('breakeven_history')
            .update({
              revenue_driver: revenue,
              profit: profit,
              rides_done: earningsRes.data.count,
              breakeven_hit: profit >= 0,
              profitable: profit > 0,
              breakdown: breakdown,
              snapshot_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError);
          } else {
            console.log(`Fixed record ${record.id}: revenue ₱${revenue}, profit ₱${profit}`);
            fixedCount++;
          }
        } else {
          console.log(`No earnings found for record ${record.id} (${record.period_start})`);
        }
      } catch (recordError) {
        console.error(`Error processing record ${record.id}:`, recordError);
      }
    }

    console.log(`[BreakevenHistoryFixer] Fixed ${fixedCount} out of ${records.length} records`);
    return { success: true, fixed: fixedCount, total: records.length };
    
  } catch (error) {
    console.error('Error in fixBreakevenHistoryRevenue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fix all breakeven history records for a driver across all period types
 */
export async function fixAllBreakevenHistoryRevenue(driverId) {
  try {
    console.log(`[BreakevenHistoryFixer] Starting comprehensive revenue fix for driver ${driverId}`);
    
    const results = {
      daily: await fixBreakevenHistoryRevenue(driverId, 'daily', 30),
      weekly: await fixBreakevenHistoryRevenue(driverId, 'weekly', 12),
      monthly: await fixBreakevenHistoryRevenue(driverId, 'monthly', 6),
    };

    const totalFixed = Object.values(results).reduce((sum, result) => sum + (result.fixed || 0), 0);
    const totalRecords = Object.values(results).reduce((sum, result) => sum + (result.total || 0), 0);

    console.log(`[BreakevenHistoryFixer] Comprehensive fix complete: ${totalFixed}/${totalRecords} records fixed`);
    
    return {
      success: true,
      results,
      totalFixed,
      totalRecords
    };
    
  } catch (error) {
    console.error('Error in fixAllBreakevenHistoryRevenue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a summary of breakeven history records that need fixing
 */
export async function getBreakevenHistoryFixSummary(driverId) {
  try {
    const summary = {};
    
    for (const periodType of ['daily', 'weekly', 'monthly']) {
      const { data, error } = await supabase
        .from('breakeven_history')
        .select('id, period_start, revenue_driver, expenses')
        .eq('driver_id', driverId)
        .eq('period_type', periodType)
        .or('revenue_driver.is.null,revenue_driver.eq.0')
        .order('period_start', { ascending: false });

      if (error) {
        console.error(`Error getting summary for ${periodType}:`, error);
        summary[periodType] = { count: 0, records: [] };
      } else {
        summary[periodType] = {
          count: data?.length || 0,
          records: data || []
        };
      }
    }

    return { success: true, summary };
  } catch (error) {
    console.error('Error in getBreakevenHistoryFixSummary:', error);
    return { success: false, error: error.message };
  }
}