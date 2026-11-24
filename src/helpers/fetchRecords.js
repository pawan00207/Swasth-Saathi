export const fetchRecords = async (web5, did) => {
  const { records, status: recordStatus } = await web5.dwn.records.query({
    message: {
      filter: {
        protocol: "http://www.alphadevs.dev/healthxprotocol",
      },
    },
  });

  let receivedRecords = [];
  let sentRecords = [];

  try {
    await Promise.allSettled(
      records.map(async (record) => {
        const result = await record.data.json();
        return result;
      })
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.recipient === did) {
            receivedRecords.push(result.value);
          } else if (result.value.sender === did) {
            sentRecords.push(result.value);
          }
        }
      });
    });
  } catch (error) {
    console.error(error);
  }

  console.log("Received Records:", receivedRecords);
  console.log("Sent Records:", sentRecords);

  let organizationTotalRecords = 0; // organization Health Records Issued
  let userTotalrecords = 0; // user - Health Records
  let recepients = {};
  let senders = {};
  let totalIssuersForUser = 0; // user total hospitals
  let totalPatientsForHospital = 0; //organization total patients

  receivedRecords.forEach((record) => {
    userTotalrecords++;
    if (recepients[record.sender] == true) {
      return;
    } else {
      recepients[record.sender] = true;
      totalIssuersForUser++;
    }
  });

  sentRecords.forEach((record) => {
    organizationTotalRecords++;
    if (senders[record.recipient] == true) {
      return;
    } else {
      senders[record.recipient] = true;
      totalPatientsForHospital++;
    }
  });

  return {
    receivedRecords,
    sentRecords,
    organizationTotalRecords,
    userTotalrecords,
    totalIssuersForUser,
    totalPatientsForHospital,
  };
};
