export const userHealthRecordsData = [
  {
    healthRecordName: "KFT",
    healthRecordCategory: "pathology",
    issuedOn: "1-1-2023",
    image: "https://www.google.com",
  },
];

export const organizationHealthRecordsData = [
  {
    healthRecordName: "KFT",
    healthRecordCategory: "pathology",
    issuedOn: "1-1-2023",
    patientName: "ABC",
    recipient: "XYZ",
    sender: "ABC",
    issuedTo: {
      did: "did:ethr:0x123456789abcdefghifjkfjvhjdscbkj,dnj",
      name: "SomeName",
    },
    image: "https://www.google.com",
  },
];

//schema for the healthRecord category filter
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
