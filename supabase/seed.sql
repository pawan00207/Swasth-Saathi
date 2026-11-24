insert into public.schemes
  (id, name, category, state, min_age, income_limit, disability_required, benefits, documents, apply_url, source_url)
values
  ('udid', 'Unique Disability ID (UDID)', 'disability', 'All India', null, null, '{}',
   'A national disability identity card to support access to eligible services.',
   array['Identity proof','Disability certificate'], 'https://www.swavlambancard.gov.in/', 'https://www.swavlambancard.gov.in/'),
  ('adip', 'ADIP Scheme', 'assistive-devices', 'All India', null, 225000, '{}',
   'Assistance for eligible assistive devices through authorized agencies.',
   array['UDID or disability certificate','Income proof','Identity proof'], 'https://alimco.in/', 'https://depwd.gov.in/schemes/'),
  ('pmjay', 'Ayushman Bharat PM-JAY', 'health-insurance', 'All India', null, null, '{}',
   'Cashless secondary and tertiary care for eligible households at empanelled hospitals.',
   array['Aadhaar or government ID','Eligibility evidence'], 'https://beneficiary.nha.gov.in/', 'https://pmjay.gov.in/'),
  ('mgnrega', 'Mahatma Gandhi National Rural Employment Guarantee Scheme', 'employment', 'All India', 18, null, '{}',
   'Wage employment for eligible rural households with a job card.',
   array['Job card','Identity proof','Bank account details'], 'https://nrega.nic.in/', 'https://nrega.nic.in/'),
  ('pm-kisan', 'PM-KISAN', 'farmer-support', 'All India', null, null, '{}',
   'Income support for eligible landholding farmer families.',
   array['Land records','Aadhaar','Bank account details'], 'https://pmkisan.gov.in/', 'https://pmkisan.gov.in/'),
  ('nsp-pre-matric-disability', 'Pre-Matric Scholarship for Students with Disabilities', 'education', 'All India', null, 250000, array['visual','hearing','mobility','intellectual','multiple'],
   'Educational assistance for eligible students with disabilities.',
   array['Disability certificate','Income certificate','School enrollment proof'], 'https://scholarships.gov.in/', 'https://scholarships.gov.in/'),
  ('nsp-post-matric-disability', 'Post-Matric Scholarship for Students with Disabilities', 'education', 'All India', null, 250000, array['visual','hearing','mobility','intellectual','multiple'],
   'Tuition and maintenance assistance subject to current scheme rules.',
   array['Disability certificate','Income certificate','Course enrollment proof'], 'https://scholarships.gov.in/', 'https://scholarships.gov.in/'),
  ('nsap-igndps', 'Indira Gandhi National Disability Pension Scheme', 'pension', 'All India', 18, null, array['visual','hearing','mobility','intellectual','multiple'],
   'Central assistance toward disability pension for eligible beneficiaries; state rules apply.',
   array['Disability certificate','Age proof','Income/BPL evidence'], 'https://nsap.nic.in/', 'https://nsap.nic.in/'),
  ('pm-vishwakarma', 'PM Vishwakarma', 'livelihood', 'All India', 18, null, '{}',
   'Skill training, toolkit support, and credit support for eligible traditional artisans.',
   array['Aadhaar','Occupation details','Bank account'], 'https://pmvishwakarma.gov.in/', 'https://pmvishwakarma.gov.in/'),
  ('stand-up-india', 'Stand-Up India', 'entrepreneurship', 'All India', 18, null, '{}',
   'Bank loans for eligible women and SC/ST entrepreneurs starting a greenfield enterprise.',
   array['Identity proof','Business plan','Category/ownership documents'], 'https://www.standupmitra.in/', 'https://www.standupmitra.in/'),
  ('bocw-state-welfare', 'Building and Other Construction Workers Welfare Boards', 'worker-welfare', 'State', 18, null, '{}',
   'State-board benefits for registered construction workers; benefits vary by state.',
   array['Worker registration','Age proof','Employment evidence'], 'https://labour.gov.in/', 'https://labour.gov.in/'),
  ('nps-traders', 'National Pension Scheme for Traders and Self-Employed Persons', 'pension', 'All India', 18, 1500000, '{}',
   'Voluntary pension contribution scheme for eligible traders and self-employed persons.',
   array['Aadhaar','Bank account','Business/occupation details'], 'https://maandhan.in/', 'https://maandhan.in/')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  state = excluded.state,
  benefits = excluded.benefits,
  documents = excluded.documents,
  apply_url = excluded.apply_url,
  source_url = excluded.source_url,
  updated_at = now();

insert into public.hospitals (name, city, state, address, latitude, longitude, speciality, emergency, wheelchair_accessible, demo)
values
  ('AIIMS New Delhi', 'New Delhi', 'Delhi', 'Ansari Nagar', 28.5672, 77.21, array['Emergency','Cardiology','Neurology'], true, null, true),
  ('PGIMER Chandigarh', 'Chandigarh', 'Chandigarh', 'Sector 12', 30.7654, 76.7752, array['Emergency','Pulmonology','Pediatrics'], true, null, true),
  ('Apollo Hospitals Chennai', 'Chennai', 'Tamil Nadu', 'Greams Road', 13.0069, 80.257, array['Emergency','Cardiology','Pediatrics'], true, null, true),
  ('KEM Hospital Mumbai', 'Mumbai', 'Maharashtra', 'Parel', 19.0018, 72.8427, array['Emergency','General Medicine'], true, null, true),
  ('NIMHANS', 'Bengaluru', 'Karnataka', 'Hosur Road', 12.9439, 77.5964, array['Neurology','Psychiatry'], true, null, true),
  ('Civil Hospital Ahmedabad', 'Ahmedabad', 'Gujarat', 'Asarwa', 23.0474, 72.6028, array['Emergency','General Medicine'], true, null, true),
  ('Ruby Hall Clinic', 'Pune', 'Maharashtra', 'Dhole Patil Road', 18.5362, 73.8742, array['Emergency','Cardiology'], true, null, true),
  ('Safdarjung Hospital', 'New Delhi', 'Delhi', 'Ring Road', 28.5687, 77.2054, array['Emergency','General Medicine'], true, null, true)
on conflict (name, city) do update set
  state = excluded.state,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  speciality = excluded.speciality,
  emergency = excluded.emergency,
  wheelchair_accessible = excluded.wheelchair_accessible,
  demo = excluded.demo;

insert into public.bed_inventory (hospital_id, bed_type, total, available)
select h.id, bed.bed_type, bed.total, bed.available
from public.hospitals h
cross join (values
  ('ICU', 30, 8),
  ('Oxygen', 60, 22),
  ('General', 120, 45),
  ('Ventilator', 15, 5)
) as bed(bed_type, total, available)
where h.demo = true
on conflict (hospital_id, bed_type) do nothing;

insert into public.doctors (name, speciality, languages, fee, registration_number, availability_slots, demo)
values
  ('Dr. Ananya Sharma', 'Cardiology', array['Hindi','English'], 1200, null, '["10:00","11:30","15:00"]'::jsonb, true),
  ('Dr. Rahul Mehta', 'Neurology', array['Hindi','Punjabi','English'], 1500, null, '["09:30","12:00","16:00"]'::jsonb, true),
  ('Dr. Kavya Iyer', 'Pediatrics', array['Tamil','English'], 900, null, '["10:30","13:00","17:00"]'::jsonb, true),
  ('Dr. Arjun Sen', 'Orthopedics', array['Kannada','Hindi','English'], 1100, null, '["09:00","14:00","16:30"]'::jsonb, true)
on conflict do nothing;
