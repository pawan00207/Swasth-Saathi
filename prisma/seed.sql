INSERT INTO "Hospital" ("id", "name", "city", "state", "address", "latitude", "longitude", "emergency", "demo", "accessibilitySource", "updatedAt")
VALUES
  ('aiims-delhi', 'AIIMS New Delhi', 'New Delhi', 'Delhi', 'Ansari Nagar', 28.5672, 77.2100, true, true, 'osm', NOW()),
  ('safdarjung', 'Safdarjung Hospital', 'New Delhi', 'Delhi', 'Ring Road', 28.5687, 77.2054, true, true, 'osm', NOW()),
  ('fortis-gurugram', 'Fortis Memorial Research Institute', 'Gurugram', 'Haryana', 'Sector 44', 28.4580, 77.0708, true, true, 'osm', NOW()),
  ('apollo-chennai', 'Apollo Hospitals Chennai', 'Chennai', 'Tamil Nadu', 'Greams Road', 13.0069, 80.2570, true, true, 'osm', NOW()),
  ('kilpauk', 'Government Kilpauk Medical College', 'Chennai', 'Tamil Nadu', 'Kilpauk', 13.0801, 80.2428, true, true, 'osm', NOW()),
  ('nimhans', 'NIMHANS', 'Bengaluru', 'Karnataka', 'Hosur Road', 12.9439, 77.5964, true, true, 'osm', NOW()),
  ('manipal-bangalore', 'Manipal Hospital Bengaluru', 'Bengaluru', 'Karnataka', 'Old Airport Road', 12.9597, 77.6457, true, true, 'osm', NOW()),
  ('pgimer', 'PGIMER Chandigarh', 'Chandigarh', 'Chandigarh', 'Sector 12', 30.7654, 76.7752, true, true, 'osm', NOW()),
  ('civil-hospital-ahmedabad', 'Civil Hospital Ahmedabad', 'Ahmedabad', 'Gujarat', 'Asarwa', 23.0474, 72.6028, true, true, 'osm', NOW()),
  ('kem-mumbai', 'KEM Hospital Mumbai', 'Mumbai', 'Maharashtra', 'Parel', 19.0018, 72.8427, true, true, 'osm', NOW()),
  ('ruby-hall-pune', 'Ruby Hall Clinic', 'Pune', 'Maharashtra', 'Dhole Patil Road', 18.5362, 73.8742, true, true, 'osm', NOW())
ON CONFLICT ("name", "city") DO NOTHING;

INSERT INTO "BedInventory" ("id", "hospitalId", "bedType", "total", "available", "updatedAt")
VALUES
  ('aiims-delhi-icu', 'aiims-delhi', 'ICU', 30, 8, NOW()),
  ('aiims-delhi-oxygen', 'aiims-delhi', 'Oxygen', 120, 24, NOW()),
  ('aiims-delhi-general', 'aiims-delhi', 'General', 400, 42, NOW()),
  ('aiims-delhi-ventilator', 'aiims-delhi', 'Ventilator', 20, 5, NOW()),
  ('safdarjung-icu', 'safdarjung', 'ICU', 20, 3, NOW()),
  ('safdarjung-oxygen', 'safdarjung', 'Oxygen', 90, 18, NOW()),
  ('safdarjung-general', 'safdarjung', 'General', 300, 35, NOW()),
  ('safdarjung-ventilator', 'safdarjung', 'Ventilator', 12, 2, NOW()),
  ('fortis-gurugram-icu', 'fortis-gurugram', 'ICU', 35, 12, NOW()),
  ('fortis-gurugram-oxygen', 'fortis-gurugram', 'Oxygen', 100, 31, NOW()),
  ('fortis-gurugram-general', 'fortis-gurugram', 'General', 250, 65, NOW()),
  ('fortis-gurugram-ventilator', 'fortis-gurugram', 'Ventilator', 25, 9, NOW()),
  ('apollo-chennai-icu', 'apollo-chennai', 'ICU', 32, 10, NOW()),
  ('apollo-chennai-oxygen', 'apollo-chennai', 'Oxygen', 110, 27, NOW()),
  ('apollo-chennai-general', 'apollo-chennai', 'General', 320, 58, NOW()),
  ('apollo-chennai-ventilator', 'apollo-chennai', 'Ventilator', 24, 7, NOW()),
  ('kilpauk-icu', 'kilpauk', 'ICU', 18, 4, NOW()),
  ('kilpauk-oxygen', 'kilpauk', 'Oxygen', 85, 15, NOW()),
  ('kilpauk-general', 'kilpauk', 'General', 280, 50, NOW()),
  ('kilpauk-ventilator', 'kilpauk', 'Ventilator', 10, 3, NOW()),
  ('nimhans-icu', 'nimhans', 'ICU', 22, 6, NOW()),
  ('nimhans-oxygen', 'nimhans', 'Oxygen', 75, 20, NOW()),
  ('nimhans-general', 'nimhans', 'General', 220, 38, NOW()),
  ('nimhans-ventilator', 'nimhans', 'Ventilator', 16, 4, NOW()),
  ('manipal-bangalore-icu', 'manipal-bangalore', 'ICU', 42, 14, NOW()),
  ('manipal-bangalore-oxygen', 'manipal-bangalore', 'Oxygen', 130, 36, NOW()),
  ('manipal-bangalore-general', 'manipal-bangalore', 'General', 360, 72, NOW()),
  ('manipal-bangalore-ventilator', 'manipal-bangalore', 'Ventilator', 30, 11, NOW()),
  ('pgimer-icu', 'pgimer', 'ICU', 28, 9, NOW()),
  ('pgimer-oxygen', 'pgimer', 'Oxygen', 95, 22, NOW()),
  ('pgimer-general', 'pgimer', 'General', 330, 44, NOW()),
  ('pgimer-ventilator', 'pgimer', 'Ventilator', 18, 6, NOW()),
  ('civil-ahmedabad-icu', 'civil-hospital-ahmedabad', 'ICU', 25, 5, NOW()),
  ('civil-ahmedabad-oxygen', 'civil-hospital-ahmedabad', 'Oxygen', 90, 19, NOW()),
  ('civil-ahmedabad-general', 'civil-hospital-ahmedabad', 'General', 310, 55, NOW()),
  ('civil-ahmedabad-ventilator', 'civil-hospital-ahmedabad', 'Ventilator', 14, 4, NOW()),
  ('kem-mumbai-icu', 'kem-mumbai', 'ICU', 26, 7, NOW()),
  ('kem-mumbai-oxygen', 'kem-mumbai', 'Oxygen', 105, 25, NOW()),
  ('kem-mumbai-general', 'kem-mumbai', 'General', 340, 48, NOW()),
  ('kem-mumbai-ventilator', 'kem-mumbai', 'Ventilator', 17, 5, NOW()),
  ('ruby-pune-icu', 'ruby-hall-pune', 'ICU', 34, 11, NOW()),
  ('ruby-pune-oxygen', 'ruby-hall-pune', 'Oxygen', 100, 29, NOW()),
  ('ruby-pune-general', 'ruby-hall-pune', 'General', 260, 60, NOW()),
  ('ruby-pune-ventilator', 'ruby-hall-pune', 'Ventilator', 24, 8, NOW())
ON CONFLICT ("hospitalId", "bedType") DO NOTHING;

INSERT INTO "Scheme" ("id", "name", "category", "state", "benefits", "documents", "updatedAt")
VALUES
  ('ayushman-bharat-pmjay', 'Ayushman Bharat - PM-JAY', 'health', 'All India', 'Health cover for eligible families; verify eligibility and benefits on the official portal.', ARRAY['Aadhaar or other accepted identity proof', 'Eligibility documents'], NOW()),
  ('national-health-mission', 'National Health Mission', 'health', 'All India', 'Public health services through participating facilities; confirm local availability with the official authority.', ARRAY['Identity proof', 'State-specific documents'], NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Doctor" ("id", "name", "speciality", "languages", "fee", "availabilitySlots", "demo")
VALUES
  ('dr-meera', 'Dr. Meera Sharma', 'General Medicine', ARRAY['Hindi', 'English'], 0, '["09:00","11:30","16:00"]'::jsonb, true),
  ('dr-rahul', 'Dr. Rahul Nair', 'Pulmonology', ARRAY['English', 'Malayalam', 'Hindi'], 0, '["10:00","13:30","18:00"]'::jsonb, true),
  ('dr-ananya', 'Dr. Ananya Sen', 'Neurology', ARRAY['Bengali', 'Hindi', 'English'], 0, '["09:30","15:00","17:30"]'::jsonb, true),
  ('dr-karthik', 'Dr. Karthik Iyer', 'Cardiology', ARRAY['Tamil', 'English', 'Hindi'], 0, '["08:30","12:00","19:00"]'::jsonb, true),
  ('dr-fatima', 'Dr. Fatima Khan', 'Rehabilitation Medicine', ARRAY['Urdu', 'Hindi', 'English'], 0, '["10:30","14:30","17:00"]'::jsonb, true),
  ('dr-arvind', 'Dr. Arvind Patel', 'Pediatrics', ARRAY['Gujarati', 'Hindi', 'English'], 0, '["09:00","12:30","16:30"]'::jsonb, true)
ON CONFLICT ("id") DO NOTHING;
