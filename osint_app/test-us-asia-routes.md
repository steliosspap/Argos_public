# US-Asia Arms Transaction Route Test

## Summary of Changes

Updated the arms transaction visualization in `src/components/intelligence/IntelligenceMap.tsx` to make routes between the US and Asian countries travel westward over the Pacific Ocean instead of eastward across the Atlantic.

### Changes Made:

1. **Route Calculation (lines 1007-1059)**:
   - Added logic to detect US-Asia transactions
   - For US-Asia routes, added waypoints to force westward routing:
     - First waypoint at -160° longitude (mid-Pacific)
     - Second waypoint at 170° longitude (near dateline)
   - Routes now curve westward across the Pacific

2. **Marker Placement (lines 978-1023)**:
   - Updated midpoint calculation for US-Asia routes
   - Places deal markers in the middle of the Pacific (-175° longitude)

### Countries Considered Asian:
Based on the logic, any country with longitude > 60°E is considered Asian, which includes:
- Japan (138.2529°E)
- China (104.1954°E)
- India (78.9629°E)
- South Korea (127.7669°E)
- Singapore (103.8198°E)
- Thailand (100.9925°E)
- Vietnam (108.2772°E)
- Indonesia (113.9213°E)
- Philippines (121.7740°E)
- Malaysia (101.9758°E)
- And other Asian countries

### Testing the Changes:

To test these changes:
1. Navigate to the Intelligence Center page
2. Look for arms transactions between the US and any Asian country
3. Verify that the route curves westward across the Pacific
4. The route should show waypoints going west from the US, crossing the dateline, and reaching Asia

### Example Routes That Will Be Affected:
- USA → Japan
- USA → South Korea
- USA → Singapore
- USA → India
- China → USA
- And any other US-Asia combination

The implementation ensures that these routes display more realistically, following the actual path that arms shipments would likely take across the Pacific Ocean.