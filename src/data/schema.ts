// Documented columns for the experiments table (the one we have data for).
// Drives the Learn page schema browser.

export interface ColumnDoc {
  name: string;
  type: 'Numeric' | 'Varchar' | 'Boolean' | 'Date' | 'Timestamp';
  description: string;
  group: string;
  /** distinct count if known. */
  distinct?: number;
  nulls?: number;
  /** Sample values (for low-cardinality dimensions). */
  values?: string[];
  /** Free-form usage caveats. */
  notes?: string;
}

export const EXPERIMENT_COLUMNS: ColumnDoc[] = [
  // Identity
  { name: 'session_id', type: 'Numeric', group: 'Identity', description: 'Unique identifier for the session' },
  { name: 'user_pseudo_id', type: 'Numeric', group: 'Identity', description: 'Anonymous unique user identifier' },
  { name: 'user_id', type: 'Numeric', group: 'Identity', description: 'Authenticated user identifier (NULL when logged-out)', nulls: 121043 },
  { name: 'affiliated_ids', type: 'Varchar', group: 'Identity', description: 'JSON array of related user IDs (cross-account ambiguity)' },
  { name: 'multiple_ids', type: 'Varchar', group: 'Identity', description: 'How many user IDs the device has touched', values: ['1-ID', 'No-ID', '2-IDs', '3+IDs'] },
  { name: 'logged_in', type: 'Varchar', group: 'Identity', description: 'Login state', values: ['logged_in', 'logged_out'] },
  { name: 'auth_method', type: 'Varchar', group: 'Identity', description: 'Auth provider used', values: ['auth0', 'google-oauth2', 'apple', 'facebook'] },

  // Time
  { name: 'event_date', type: 'Date', group: 'Time', description: 'Date when the event occurred (local)' },
  { name: 'event_date_utc', type: 'Date', group: 'Time', description: 'Event date in UTC (table partition)' },
  { name: 'event_timestamp', type: 'Timestamp', group: 'Time', description: 'Event timestamp (local)' },
  { name: 'event_timestamp_utc', type: 'Timestamp', group: 'Time', description: 'Event timestamp in UTC' },

  // Experiment
  { name: 'experiment_name', type: 'Varchar', group: 'Experiment', description: 'Name of the experiment', distinct: 14 },
  { name: 'experiment_variation', type: 'Varchar', group: 'Experiment', description: 'Variation assigned to this user/session', distinct: 19 },
  { name: 'feature_flag_id', type: 'Varchar', group: 'Experiment', description: 'Underlying feature flag ID (high-cardinality)' },
  { name: 'other_experiments', type: 'Varchar', group: 'Experiment', description: 'Other experiments active in the same session' },

  // Page / navigation
  { name: 'page', type: 'Varchar', group: 'Navigation', description: 'Page URL or path where the experiment fired' },
  { name: 'landing_page_path', type: 'Varchar', group: 'Navigation', description: 'First page of the session' },
  { name: 'is_entrance', type: 'Boolean', group: 'Navigation', description: 'First event of the session' },
  { name: 'is_exit', type: 'Boolean', group: 'Navigation', description: 'Last event of the session' },
  { name: 'prev_page_path', type: 'Varchar', group: 'Navigation', description: 'Path of the previous page' },
  { name: 'prev_prev_page_path', type: 'Varchar', group: 'Navigation', description: 'Path two pages back' },
  { name: 'next_page_path', type: 'Varchar', group: 'Navigation', description: 'Path of the next page' },
  { name: 'next_next_page_path', type: 'Varchar', group: 'Navigation', description: 'Path two pages forward' },

  // Device
  { name: 'device_platform', type: 'Varchar', group: 'Device', description: 'Web vs. app surface', values: ['mobile_web', 'desktop'] },
  { name: 'device_category', type: 'Varchar', group: 'Device', description: 'Device class', values: ['mobile', 'desktop', 'tablet', 'smart tv'] },
  { name: 'device_brand', type: 'Varchar', group: 'Device', description: 'Manufacturer (Apple, Samsung, etc.)' },
  { name: 'mobile_device_model', type: 'Varchar', group: 'Device', description: 'Device model name' },
  { name: 'browser_app', type: 'Varchar', group: 'Device', description: 'Browser or in-app webview' },
  { name: 'browser_app_version', type: 'Varchar', group: 'Device', description: 'Version string' },
  { name: 'operating_system', type: 'Varchar', group: 'Device', description: 'OS name', values: ['Android', 'iOS', 'Windows', 'Macintosh', 'Linux', 'Chrome OS'] },
  { name: 'operating_system_version', type: 'Varchar', group: 'Device', description: 'OS version string' },
  { name: 'live_app_version', type: 'Varchar', group: 'Device', description: 'Native app version (mobile only)' },
  { name: 'screen_width', type: 'Numeric', group: 'Device', description: 'Device screen width in px' },
  { name: 'screen_height', type: 'Numeric', group: 'Device', description: 'Device screen height in px' },

  // Geography
  { name: 'country', type: 'Varchar', group: 'Geography', description: 'Country derived from IP', distinct: 108 },
  { name: 'state', type: 'Varchar', group: 'Geography', description: 'State / region' },
  { name: 'metro', type: 'Varchar', group: 'Geography', description: 'Metro area' },

  // Attribution
  { name: 'channel_session', type: 'Varchar', group: 'Attribution', description: 'Channel attributed at session start' },
  { name: 'channel_last_click', type: 'Varchar', group: 'Attribution', description: 'Last-click channel attribution' },

  // Behavior
  { name: 'session_number', type: 'Varchar', group: 'Behavior', description: 'Sequential session number for the user', values: ['1', '2', '3', '4', '5', '>5'] },
  { name: 'session_duration', type: 'Varchar', group: 'Behavior', description: 'Bucketed duration', values: ['<1min', '1min-2min', '2min-5min', '5min-10min', '10min-30min', '0.5hr-1hr', '>1hr', '0'] },
  { name: 'days_since_first_session', type: 'Varchar', group: 'Behavior', description: 'Bucketed recency from first visit' },
  { name: 'days_since_last_session', type: 'Varchar', group: 'Behavior', description: 'Bucketed recency from last visit' },
  { name: 'purchase_history', type: 'Varchar', group: 'Behavior', description: 'Whether user has purchased before', values: ['no_prior_purchase', 'prior_purchase'] },
  { name: 'cardholder', type: 'Boolean', group: 'Behavior', description: 'Co-brand credit card holder' },

  // Trip
  { name: 'origin', type: 'Varchar', group: 'Trip', description: 'Origin airport code' },
  { name: 'destination', type: 'Varchar', group: 'Trip', description: 'Destination airport code' },
  { name: 'route', type: 'Varchar', group: 'Trip', description: 'Origin-Destination string' },
  { name: 'origin_tier_name', type: 'Varchar', group: 'Trip', description: 'Origin market tier' },
  { name: 'destination_tier_name', type: 'Varchar', group: 'Trip', description: 'Destination market tier' },
  { name: 'trip_direction', type: 'Varchar', group: 'Trip', description: 'Cardinal direction', values: ['N-S', 'S-N', 'E-W', 'W-E'] },
  { name: 'miles_between', type: 'Varchar', group: 'Trip', description: 'Bucketed distance' },
  { name: 'days_to_departure', type: 'Varchar', group: 'Trip', description: 'Days until departure' },
  { name: 'trip_duration_days', type: 'Varchar', group: 'Trip', description: 'Length of trip' },
  { name: 'trip_type', type: 'Varchar', group: 'Trip', description: 'one-way / round-trip', values: ['one-way', 'round-trip'] },
  { name: 'total_passengers', type: 'Varchar', group: 'Trip', description: 'Bucketed pax count' },
  { name: 'multi_pax', type: 'Varchar', group: 'Trip', description: 'Group composition' },
  { name: 'kid_pax', type: 'Varchar', group: 'Trip', description: 'Kid passenger flag' },
  { name: 'itinerary_source', type: 'Varchar', group: 'Trip', description: 'Where the itinerary was last touched' },

  // Quality
  { name: 'is_final', type: 'Boolean', group: 'Quality', description: 'Row is final (data has settled, ~3 days)' },
];

export const COLUMN_GROUPS = Array.from(new Set(EXPERIMENT_COLUMNS.map((c) => c.group)));

export const AD_SPEND_COLUMNS: ColumnDoc[] = [
  { name: 'date', type: 'Date', group: 'Time', description: 'Date of the recorded metrics (single-day rows)' },
  { name: 'source', type: 'Varchar', group: 'Attribution', description: 'Advertising source platform', values: ['google', 'facebook', 'bing'] },
  { name: 'datasource', type: 'Varchar', group: 'Attribution', description: 'WindsorAI datasource identifier', values: ['google_ads', 'facebook', 'bing'] },
  { name: 'account_name', type: 'Varchar', group: 'Attribution', description: 'Advertising account', values: ['MX_US (en)', 'MX Discovery', 'Breeze Airways'] },
  { name: 'campaign', type: 'Varchar', group: 'Attribution', description: 'Campaign identifier or name. Mixed-case — LOWER() when joining to GA4.', notes: 'One-of-a-kind per row in the current dataset.' },
  { name: 'spend', type: 'Numeric', group: 'Metric', description: 'Amount spent on advertising (currency)' },
  { name: 'clicks', type: 'Numeric', group: 'Metric', description: 'Number of ad clicks' },
  { name: 'impressions', type: 'Numeric', group: 'Metric', description: 'Number of ad impressions' },
];

export const AD_SPEND_GROUPS = Array.from(new Set(AD_SPEND_COLUMNS.map((c) => c.group)));

export const SESSIONS_COLUMNS: ColumnDoc[] = [
  // Identity
  { name: 'session_id', type: 'Numeric', group: 'Identity', description: 'Unique session identifier (primary key)' },
  { name: 'user_pseudo_id', type: 'Varchar', group: 'Identity', description: 'Anonymous user identifier' },
  { name: 'user_id', type: 'Numeric', group: 'Identity', description: 'Authenticated user ID (NULL if logged-out, ~54% of rows)' },
  { name: 'all_user_pseudo_ids', type: 'Varchar', group: 'Identity', description: 'JSON array of all user pseudo IDs seen' },
  { name: 'affiliated_ids', type: 'Varchar', group: 'Identity', description: 'JSON array of related user IDs' },
  { name: 'logged_in', type: 'Boolean', group: 'Identity', description: 'User was logged in during the session' },
  { name: 'auth_method', type: 'Varchar', group: 'Identity', description: 'Auth provider', values: ['auth0', 'google-oauth2', 'apple', 'facebook'] },

  // Time
  { name: 'session_date', type: 'Date', group: 'Time', description: 'Date of session (partition)' },
  { name: 'session_start_timestamp_utc', type: 'Timestamp', group: 'Time', description: 'Session start time (UTC)' },
  { name: 'session_end_timestamp_utc', type: 'Timestamp', group: 'Time', description: 'Session end time (UTC)' },
  { name: 'session_duration_s', type: 'Numeric', group: 'Time', description: 'Session duration in seconds' },
  { name: 'engagement_time_msec', type: 'Numeric', group: 'Time', description: 'Total engagement time in ms' },
  { name: 'multiday', type: 'Boolean', group: 'Time', description: 'Session spans midnight' },

  // Conversions
  { name: 'bookings', type: 'Numeric', group: 'Conversion', description: 'Number of bookings in this session' },
  { name: 'sign_ups', type: 'Numeric', group: 'Conversion', description: 'Number of sign-ups' },
  { name: 'check_in', type: 'Numeric', group: 'Conversion', description: '1 if check-in happened' },
  { name: 'cancellations', type: 'Numeric', group: 'Conversion', description: 'Number of cancellations' },
  { name: 'modify_trip_purchases', type: 'Numeric', group: 'Conversion', description: 'Modified trip purchase count' },
  { name: 'checkin_purchases', type: 'Numeric', group: 'Conversion', description: 'Check-in purchase count' },
  { name: 'onboard_purchases', type: 'Numeric', group: 'Conversion', description: 'Onboard purchase count' },

  // Revenue
  { name: 'booking_revenue', type: 'Numeric', group: 'Revenue', description: 'Booking revenue (NULL for non-booking sessions)' },
  { name: 'booking_revenue_net', type: 'Numeric', group: 'Revenue', description: 'Net booking revenue after refunds' },
  { name: 'modify_trip_revenue', type: 'Numeric', group: 'Revenue', description: 'Revenue from trip modifications' },
  { name: 'checkin_revenue', type: 'Numeric', group: 'Revenue', description: 'Revenue from check-in upgrades' },
  { name: 'onboard_revenue', type: 'Numeric', group: 'Revenue', description: 'Revenue from onboard purchases' },
  { name: 'refunded_amount', type: 'Numeric', group: 'Revenue', description: 'Total refund amount' },
  { name: 'base_revenue_booking', type: 'Numeric', group: 'Revenue', description: 'Base fare component' },
  { name: 'bundle_revenue_booking', type: 'Numeric', group: 'Revenue', description: 'Bundle upsell revenue' },
  { name: 'bag_revenue_booking', type: 'Numeric', group: 'Revenue', description: 'Bag revenue at booking' },
  { name: 'seat_revenue_booking', type: 'Numeric', group: 'Revenue', description: 'Seat revenue at booking' },
  { name: 'insurance_revenue_booking', type: 'Numeric', group: 'Revenue', description: 'Travel insurance revenue' },
  { name: 'car_revenue_booking', type: 'Numeric', group: 'Revenue', description: 'Car rental revenue' },

  // Attribution — first click
  { name: 'channel_first_click', type: 'Varchar', group: 'Attribution', description: 'First-click channel' },
  { name: 'source_first_click', type: 'Varchar', group: 'Attribution', description: 'First-click source (google, bing, …)' },
  { name: 'medium_first_click', type: 'Varchar', group: 'Attribution', description: 'First-click medium (cpc, organic, email, …)' },
  { name: 'campaign_first_click', type: 'Varchar', group: 'Attribution', description: 'First-click campaign name' },
  // Attribution — last click
  { name: 'channel_last_click', type: 'Varchar', group: 'Attribution', description: 'Last-click channel' },
  { name: 'source_last_click', type: 'Varchar', group: 'Attribution', description: 'Last-click source' },
  { name: 'medium_last_click', type: 'Varchar', group: 'Attribution', description: 'Last-click medium' },
  { name: 'campaign_last_click', type: 'Varchar', group: 'Attribution', description: 'Last-click campaign (LOWER() for ad_spend joins)' },
  // Attribution — session
  { name: 'channel_session', type: 'Varchar', group: 'Attribution', description: 'Channel assigned to this session' },
  { name: 'source_session', type: 'Varchar', group: 'Attribution', description: 'Source assigned to this session' },
  { name: 'medium_session', type: 'Varchar', group: 'Attribution', description: 'Medium assigned to this session' },
  { name: 'campaign_session', type: 'Varchar', group: 'Attribution', description: 'Campaign assigned to this session' },
  // Parsed attribution
  { name: 'parsed_channel_session', type: 'Varchar', group: 'Attribution', description: 'Parsed channel bucket', values: ['Paid Search', 'Paid Social', 'Display', 'Other'] },
  { name: 'parsed_publisher_session', type: 'Varchar', group: 'Attribution', description: 'Parsed publisher', values: ['Google', 'Facebook', 'Bing', 'Other'] },
  { name: 'parsed_targeting_session', type: 'Varchar', group: 'Attribution', description: 'Parsed targeting intent' },
  { name: 'parsed_budget_session', type: 'Varchar', group: 'Attribution', description: 'Parsed budget bucket' },
  { name: 'parsed_geo_session', type: 'Varchar', group: 'Attribution', description: 'Parsed geo bucket' },
  { name: 'gclid_session', type: 'Varchar', group: 'Attribution', description: 'Google click ID' },
  { name: 'msclkid_session', type: 'Varchar', group: 'Attribution', description: 'Microsoft click ID' },

  // Device
  { name: 'device_platform', type: 'Varchar', group: 'Device', description: 'Surface type', values: ['mobile_app', 'mobile_web', 'desktop'] },
  { name: 'app_platform', type: 'Varchar', group: 'Device', description: 'App platform', values: ['IOS', 'ANDROID', 'WEB'] },
  { name: 'device_category', type: 'Varchar', group: 'Device', description: 'Device class', values: ['mobile', 'desktop', 'tablet', 'smart tv'] },
  { name: 'device_brand', type: 'Varchar', group: 'Device', description: 'Manufacturer' },
  { name: 'mobile_device_model', type: 'Varchar', group: 'Device', description: 'Device model' },
  { name: 'browser_app', type: 'Varchar', group: 'Device', description: 'Browser or in-app view' },
  { name: 'operating_system', type: 'Varchar', group: 'Device', description: 'OS name' },
  { name: 'operating_system_version', type: 'Varchar', group: 'Device', description: 'OS version' },
  { name: 'live_app_version', type: 'Varchar', group: 'Device', description: 'Breeze app version' },

  // Geography
  { name: 'continent', type: 'Varchar', group: 'Geography', description: 'Continent', values: ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania'] },
  { name: 'sub_continent', type: 'Varchar', group: 'Geography', description: 'Sub-continent' },
  { name: 'country', type: 'Varchar', group: 'Geography', description: 'Country' },
  { name: 'region', type: 'Varchar', group: 'Geography', description: 'State / region' },
  { name: 'city', type: 'Varchar', group: 'Geography', description: 'City' },
  { name: 'metro', type: 'Varchar', group: 'Geography', description: 'Metro area' },

  // Page / navigation
  { name: 'landing_page_path', type: 'Varchar', group: 'Navigation', description: 'First page of the session' },
  { name: 'landing_page_location', type: 'Varchar', group: 'Navigation', description: 'Full landing page URL' },
  { name: 'landing_page_referrer', type: 'Varchar', group: 'Navigation', description: 'Referrer of landing page' },
  { name: 'exit_page_path', type: 'Varchar', group: 'Navigation', description: 'Last page of the session' },
  { name: 'exit_page_location', type: 'Varchar', group: 'Navigation', description: 'Full exit page URL' },
  { name: 'page_views', type: 'Numeric', group: 'Navigation', description: 'Count of page_view events' },

  // Funnel flags
  { name: 'availability_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw availability page' },
  { name: 'passengers_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw passengers page' },
  { name: 'seats_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw seats page' },
  { name: 'bags_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw bags page' },
  { name: 'extras_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw extras page' },
  { name: 'payment_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw payment page' },
  { name: 'success_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw booking success page' },
  { name: 'flexible_calendar_page', type: 'Numeric', group: 'Funnel', description: '1 if user saw flex calendar' },

  // Trip
  { name: 'origin', type: 'Varchar', group: 'Trip', description: 'Origin airport code' },
  { name: 'origin_name', type: 'Varchar', group: 'Trip', description: 'Origin airport name' },
  { name: 'origin_tier_name', type: 'Varchar', group: 'Trip', description: 'Origin market tier' },
  { name: 'destination', type: 'Varchar', group: 'Trip', description: 'Destination airport code' },
  { name: 'destination_name', type: 'Varchar', group: 'Trip', description: 'Destination airport name' },
  { name: 'destination_tier_name', type: 'Varchar', group: 'Trip', description: 'Destination market tier' },
  { name: 'trip_direction', type: 'Varchar', group: 'Trip', description: 'Cardinal direction', values: ['N-S', 'S-N', 'E-W', 'W-E'] },
  { name: 'miles_between', type: 'Numeric', group: 'Trip', description: 'Distance in miles' },
  { name: 'departure_date', type: 'Date', group: 'Trip', description: 'Outbound date' },
  { name: 'return_date', type: 'Date', group: 'Trip', description: 'Return date' },
  { name: 'days_to_departure', type: 'Numeric', group: 'Trip', description: 'Days until departure' },
  { name: 'trip_duration_days', type: 'Numeric', group: 'Trip', description: 'Length of trip in days' },
  { name: 'adult_passengers', type: 'Numeric', group: 'Trip', description: 'Number of adult passengers' },
  { name: 'child_passengers', type: 'Numeric', group: 'Trip', description: 'Number of child passengers' },
  { name: 'infant_passengers', type: 'Numeric', group: 'Trip', description: 'Number of infant passengers' },

  // Behavior
  { name: 'session_number', type: 'Numeric', group: 'Behavior', description: 'Sequential session number for the user' },
  { name: 'days_since_first_session', type: 'Numeric', group: 'Behavior', description: 'Days since first ever visit' },
  { name: 'days_since_last_session', type: 'Numeric', group: 'Behavior', description: 'Days since previous visit' },
  { name: 'purchase_history', type: 'Varchar', group: 'Behavior', description: 'Whether the user has purchased before', values: ['no_prior_purchase', 'prior_purchase'] },
  { name: 'cardholder', type: 'Boolean', group: 'Behavior', description: 'Breeze co-brand cardholder' },
  { name: 'experiment_assignments', type: 'Varchar', group: 'Behavior', description: 'JSON array of experiment-variation pairs active this session' },

  // Quality
  { name: 'is_final', type: 'Boolean', group: 'Quality', description: 'Row is final (data has settled)' },
];

export const SESSIONS_GROUPS = Array.from(new Set(SESSIONS_COLUMNS.map((c) => c.group)));

export const EVENTS_COLUMNS: ColumnDoc[] = [
  // Identity
  { name: 'event_id', type: 'Numeric', group: 'Identity', description: 'Unique event identifier' },
  { name: 'session_id', type: 'Numeric', group: 'Identity', description: 'Session this event belongs to' },
  { name: 'user_pseudo_id', type: 'Varchar', group: 'Identity', description: 'Anonymous user ID' },
  { name: 'user_id', type: 'Numeric', group: 'Identity', description: 'Authenticated user ID' },
  { name: 'event_user_id', type: 'Numeric', group: 'Identity', description: 'User ID at event time' },
  { name: 'affiliated_ids', type: 'Varchar', group: 'Identity', description: 'JSON array of related user IDs' },
  { name: 'growthbookAnonId', type: 'Varchar', group: 'Identity', description: 'GrowthBook anonymous ID' },
  { name: 'logged_in', type: 'Boolean', group: 'Identity', description: 'User was logged in at event' },
  { name: 'auth_method', type: 'Varchar', group: 'Identity', description: 'Auth provider used' },

  // Event definition
  { name: 'event_name', type: 'Varchar', group: 'Event', description: 'Event type — 12 values observed', values: ['wifi_check', 'add_to_cart', 'user_engagement', 'track_click', 'page_view', 'hovr', 'login', 'glad_app', 'flight_search_submitted', 'flight_search_ui', 'view_item', 'wifi_ad_portal'] },
  { name: 'event_detail', type: 'Varchar', group: 'Event', description: 'Event sub-type / detail' },
  { name: 'interaction', type: 'Varchar', group: 'Event', description: 'Interaction kind' },
  { name: 'clicked_element', type: 'Varchar', group: 'Event', description: 'Element that was clicked (modal names, nav items)' },
  { name: 'items', type: 'Varchar', group: 'Event', description: 'JSON array of ecommerce items for purchase events' },

  // Time
  { name: 'event_date', type: 'Date', group: 'Time', description: 'Event date (partition)' },
  { name: 'event_timestamp_utc', type: 'Timestamp', group: 'Time', description: 'Event time (UTC)' },
  { name: 'timestamp_local', type: 'Timestamp', group: 'Time', description: 'Event time (local to user)' },
  { name: 'seconds_on_page', type: 'Numeric', group: 'Time', description: 'Time spent on current page' },
  { name: 'seconds_to_next_event', type: 'Numeric', group: 'Time', description: 'Gap to the next event' },
  { name: 'engagement_time_msec', type: 'Numeric', group: 'Time', description: 'Engagement time in ms' },

  // Navigation
  { name: 'path', type: 'Varchar', group: 'Navigation', description: 'Page path' },
  { name: 'page_url', type: 'Varchar', group: 'Navigation', description: 'Full page URL' },
  { name: 'page_title', type: 'Varchar', group: 'Navigation', description: 'Page title' },
  { name: 'hit_number', type: 'Numeric', group: 'Navigation', description: 'Hit sequence within session' },
  { name: 'page_number', type: 'Numeric', group: 'Navigation', description: 'Page sequence within session' },
  { name: 'is_entrance', type: 'Boolean', group: 'Navigation', description: 'First event of session' },
  { name: 'is_exit', type: 'Boolean', group: 'Navigation', description: 'Last event of session' },
  { name: 'prev_page_path', type: 'Varchar', group: 'Navigation', description: 'Previous page' },
  { name: 'next_page_path', type: 'Varchar', group: 'Navigation', description: 'Next page' },
  { name: 'referrer', type: 'Varchar', group: 'Navigation', description: 'Referrer URL' },
  { name: 'hostname', type: 'Varchar', group: 'Navigation', description: 'Host domain' },

  // Ecommerce values
  { name: 'value', type: 'Numeric', group: 'Ecommerce', description: 'Total event value (revenue)' },
  { name: 'tax', type: 'Numeric', group: 'Ecommerce', description: 'Tax portion of value' },
  { name: 'currency', type: 'Varchar', group: 'Ecommerce', description: 'Currency code' },
  { name: 'basis', type: 'Varchar', group: 'Ecommerce', description: 'Value basis', values: ['currency', 'points'] },
  { name: 'total_item_quantity', type: 'Numeric', group: 'Ecommerce', description: 'Total items in the event' },
  { name: 'quantity_seat', type: 'Numeric', group: 'Ecommerce', description: 'Seats in cart' },
  { name: 'quantity_bag', type: 'Numeric', group: 'Ecommerce', description: 'Bags in cart' },
  { name: 'quantity_bundle', type: 'Numeric', group: 'Ecommerce', description: 'Bundles in cart' },
  { name: 'quantity_journey', type: 'Numeric', group: 'Ecommerce', description: 'Journeys in cart' },
  { name: 'value_seat_standard', type: 'Numeric', group: 'Ecommerce', description: 'Value of standard seats' },
  { name: 'value_seat_xl', type: 'Numeric', group: 'Ecommerce', description: 'Value of XL seats' },
  { name: 'value_seat_ascent', type: 'Numeric', group: 'Ecommerce', description: 'Value of Ascent seats' },
  { name: 'value_bag_carry_on', type: 'Numeric', group: 'Ecommerce', description: 'Value of carry-on bags' },
  { name: 'value_bag_checked', type: 'Numeric', group: 'Ecommerce', description: 'Value of checked bags' },
  { name: 'value_bundle_nice', type: 'Numeric', group: 'Ecommerce', description: 'Value of Nice bundles' },
  { name: 'value_bundle_nicer', type: 'Numeric', group: 'Ecommerce', description: 'Value of Nicer bundles' },
  { name: 'value_bundle_nicest', type: 'Numeric', group: 'Ecommerce', description: 'Value of Nicest bundles' },
  { name: 'value_car_rental', type: 'Numeric', group: 'Ecommerce', description: 'Value of car rental' },

  // Attribution
  { name: 'campaign', type: 'Varchar', group: 'Attribution', description: 'Campaign on this event' },
  { name: 'source', type: 'Varchar', group: 'Attribution', description: 'Traffic source' },
  { name: 'medium', type: 'Varchar', group: 'Attribution', description: 'Traffic medium' },
  { name: 'term', type: 'Varchar', group: 'Attribution', description: 'Search term' },
  { name: 'gclid', type: 'Varchar', group: 'Attribution', description: 'Google click ID' },
  { name: 'url_params', type: 'Varchar', group: 'Attribution', description: 'Parsed utm_* params (JSON)' },
  { name: 'fixed_traffic_source', type: 'Varchar', group: 'Attribution', description: 'Corrected traffic source (JSON)' },

  // Device
  { name: 'device_platform', type: 'Varchar', group: 'Device', description: 'Surface', values: ['mobile_app', 'mobile_web', 'desktop'] },
  { name: 'app_platform', type: 'Varchar', group: 'Device', description: 'App platform', values: ['IOS', 'ANDROID', 'WEB'] },
  { name: 'device_category', type: 'Varchar', group: 'Device', description: 'Device class' },
  { name: 'device_brand', type: 'Varchar', group: 'Device', description: 'Manufacturer' },
  { name: 'browser_app', type: 'Varchar', group: 'Device', description: 'Browser / in-app' },
  { name: 'operating_system', type: 'Varchar', group: 'Device', description: 'OS' },
  { name: 'live_app_version', type: 'Varchar', group: 'Device', description: 'Breeze app version' },

  // Geography
  { name: 'country', type: 'Varchar', group: 'Geography', description: 'Country' },
  { name: 'region', type: 'Varchar', group: 'Geography', description: 'Region' },
  { name: 'city', type: 'Varchar', group: 'Geography', description: 'City' },
  { name: 'metro', type: 'Varchar', group: 'Geography', description: 'Metro' },

  // Trip
  { name: 'origin', type: 'Varchar', group: 'Trip', description: 'Origin airport' },
  { name: 'destination', type: 'Varchar', group: 'Trip', description: 'Destination airport' },
  { name: 'origin_tier_name', type: 'Varchar', group: 'Trip', description: 'Origin market tier' },
  { name: 'destination_tier_name', type: 'Varchar', group: 'Trip', description: 'Destination market tier' },
  { name: 'trip_direction', type: 'Varchar', group: 'Trip', description: 'Direction' },
  { name: 'miles_between', type: 'Numeric', group: 'Trip', description: 'Distance' },
  { name: 'departure_date', type: 'Date', group: 'Trip', description: 'Outbound date' },
  { name: 'return_date', type: 'Date', group: 'Trip', description: 'Return date' },
  { name: 'days_to_departure', type: 'Numeric', group: 'Trip', description: 'Days until departure' },
  { name: 'pnr', type: 'Varchar', group: 'Trip', description: 'Passenger name record' },
  { name: 'flight_number', type: 'Varchar', group: 'Trip', description: 'Flight number' },
  { name: 'flight_direction', type: 'Varchar', group: 'Trip', description: 'inbound / outbound' },

  // Quality
  { name: 'is_final', type: 'Boolean', group: 'Quality', description: 'Row is final' },
  { name: 'intraday_data', type: 'Boolean', group: 'Quality', description: 'Intraday streaming data' },
  { name: 'cf_bot_score', type: 'Numeric', group: 'Quality', description: 'Cloudflare bot score (higher = more likely human)' },
  { name: 'end_of_session', type: 'Boolean', group: 'Quality', description: 'End-of-session marker' },
];

export const EVENTS_GROUPS = Array.from(new Set(EVENTS_COLUMNS.map((c) => c.group)));

export function columnsForTable(key: string): { columns: ColumnDoc[]; groups: string[] } {
  if (key === 'ad_spend') return { columns: AD_SPEND_COLUMNS, groups: AD_SPEND_GROUPS };
  if (key === 'ga4_experiments') return { columns: EXPERIMENT_COLUMNS, groups: COLUMN_GROUPS };
  if (key === 'ga4_sessions') return { columns: SESSIONS_COLUMNS, groups: SESSIONS_GROUPS };
  if (key === 'ga4_events') return { columns: EVENTS_COLUMNS, groups: EVENTS_GROUPS };
  return { columns: [], groups: [] };
}
