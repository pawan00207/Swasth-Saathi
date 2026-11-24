import { atom } from "recoil";

import { recoilPersist } from "recoil-persist";

const { persistAtom } = recoilPersist();

export const web5State = atom({
  key: "web5State", // unique ID (with respect to other atoms/selectors)
  default: null, // default value (aka initial value)
  effects_UNSTABLE: [persistAtom],
});

export const didState = atom({
  key: "didState", // unique ID (with respect to other atoms/selectors)
  default: {
    did: "",
    name: "",
    year: "",
    userType: "",
    organizationTotalRecords: 0,
    userTotalrecords: 0,
    totalIssuersForUser: 0,
    totalPatientsForHospital: 0,
  }, // default value (aka initial value)
  effects_UNSTABLE: [persistAtom],
});

export const healthRecordsState = atom({
  key: "healthRecordsState", // unique ID (with respect to other atoms/selectors)
  default: [{}], // default value (aka initial value)
  effects_UNSTABLE: [persistAtom],
});

export const imageState = atom({
  key: "imageState", // unique ID (with respect to other atoms/selectors)
  default: "", // default value (aka initial value)
  effects_UNSTABLE: [persistAtom],
});
