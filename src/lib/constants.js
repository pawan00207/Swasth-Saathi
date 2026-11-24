export const userHealthRecordsData = [
  {
    healthRecordName: "REC-AIIMS-2026-0412",
    healthRecordCategory: "Cardiology",
    issuedOn: "2026-11-22",
    image: "/api/reports/download/REC-AIIMS-2026-0412",
  },
  {
    healthRecordName: "KFT",
    healthRecordCategory: "Pathology",
    issuedOn: "2026-11-04",
    image: "/api/reports/download/KFT",
  },
];

export const organizationHealthRecordsData = [
  {
    healthRecordName: "REC-AIIMS-2026-0412",
    healthRecordCategory: "Cardiology",
    issuedOn: "2026-11-22",
    patientName: "Aarav Sharma",
    recipient: "did:ion:EiAaravSharma9821",
    sender: "AIIMS New Delhi",
    issuedTo: {
      did: "did:ethr:0x4b92e18a0f3c7d91e2a0b4817c910f32d18e4401",
      name: "Aarav Sharma",
    },
    image: "/api/reports/download/REC-AIIMS-2026-0412",
  },
  {
    healthRecordName: "REC-SAFD-2026-0389",
    healthRecordCategory: "Radiology",
    issuedOn: "2026-11-18",
    patientName: "Aarav Sharma",
    recipient: "did:ion:EiAaravSharma9821",
    sender: "Safdarjung Hospital",
    issuedTo: {
      did: "did:ethr:0x4b92e18a0f3c7d91e2a0b4817c910f32d18e4401",
      name: "Aarav Sharma",
    },
    image: "/api/reports/download/REC-SAFD-2026-0389",
  },
];

export const healthRecordCategoryOptions = [
  {
    value: "Radiology",
    label: "Radiology",
  },
  {
    value: "Pathology",
    label: "Pathology",
  },
  {
    value: "Cardiology",
    label: "Cardiology",
  },
  {
    value: "Neurology",
    label: "Neurology",
  },
];
