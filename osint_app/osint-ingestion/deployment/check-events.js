import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvents() {
    try {
        console.log('Checking Supabase events...\n');

        // 1. Total number of events
        const { data: allEvents, error: countError } = await supabase
            .from('events')
            .select('id');

        if (countError) {
            console.error('Error counting total events:', countError);
        } else {
            const totalEvents = allEvents ? allEvents.length : 0;
            console.log(`1. Total number of events: ${totalEvents}`);

            // 2. Number of events with coordinates
            const { data: coordEvents, error: coordsError } = await supabase
                .from('events')
                .select('id')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (coordsError) {
                console.error('Error counting events with coordinates:', coordsError);
            } else {
                const eventsWithCoords = coordEvents ? coordEvents.length : 0;
                console.log(`2. Events with coordinates: ${eventsWithCoords}`);
                if (totalEvents > 0) {
                    const percentage = ((eventsWithCoords / totalEvents) * 100).toFixed(2);
                    console.log(`   (${percentage}% of total events)`);
                }
            }
        }

        // 3. Recent events (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentEventsList, error: recentError } = await supabase
            .from('events')
            .select('id')
            .gte('created_at', oneHourAgo);

        if (recentError) {
            console.error('Error counting recent events:', recentError);
        } else {
            console.log(`3. Events in the last hour: ${recentEvents}`);
        }

        // 4. Sample of recent events with their coordinates
        console.log('\n4. Sample of recent events with coordinates:');
        console.log('=' * 80);

        const { data: sampleEvents, error: sampleError } = await supabase
            .from('events')
            .select('id, title, location, latitude, longitude, created_at, source')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (sampleError) {
            console.error('Error fetching sample events:', sampleError);
        } else if (sampleEvents && sampleEvents.length > 0) {
            sampleEvents.forEach((event, index) => {
                console.log(`\nEvent ${index + 1}:`);
                console.log(`  ID: ${event.id}`);
                console.log(`  Title: ${event.title}`);
                console.log(`  Location: ${event.location || 'N/A'}`);
                console.log(`  Coordinates: ${event.latitude}, ${event.longitude}`);
                console.log(`  Source: ${event.source}`);
                console.log(`  Created: ${new Date(event.created_at).toLocaleString()}`);
            });
        } else {
            console.log('No events with coordinates found.');
        }

        // Additional statistics
        console.log('\n5. Additional Statistics:');
        console.log('=' * 80);

        // Events by source
        const { data: sourceStats, error: sourceError } = await supabase
            .from('events')
            .select('source')
            .not('source', 'is', null);

        if (!sourceError && sourceStats) {
            const sourceCounts = sourceStats.reduce((acc, event) => {
                acc[event.source] = (acc[event.source] || 0) + 1;
                return acc;
            }, {});

            console.log('\nEvents by source:');
            Object.entries(sourceCounts)
                .sort(([, a], [, b]) => b - a)
                .forEach(([source, count]) => {
                    console.log(`  ${source}: ${count}`);
                });
        }

        // Recent events without coordinates
        const { data: noCoordEvents, error: noCoordError } = await supabase
            .from('events')
            .select('id, title, location, created_at')
            .or('latitude.is.null,longitude.is.null')
            .order('created_at', { ascending: false })
            .limit(3);

        if (!noCoordError && noCoordEvents && noCoordEvents.length > 0) {
            console.log('\nRecent events without coordinates:');
            noCoordEvents.forEach((event) => {
                console.log(`  - ${event.title} (Location: ${event.location || 'N/A'})`);
            });
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Run the check
checkEvents().then(() => {
    console.log('\nCheck completed.');
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});