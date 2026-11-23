import React, { useEffect } from "react";
import { imageState } from "../atoms/data";
import { useRecoilValue } from "recoil";
import { useState } from "react";

const ViewHealthRecord = () => {
  const imageSrc = useRecoilValue(imageState);
  const [image, setImage] = useState("");

  useEffect(() => {
    // get base64 image from atom state
    console.log("Image Source :", imageSrc);
    setImage(imageSrc);
  }, []);

  return (
    <div className="p-8 flex flex-col justify-center items-center gap-4">
      <h1 className="text-3xl font-bold">Health Record</h1>
      <img className="mx-16" src={image} alt="Health record image" />
    </div>
  );
};

export default ViewHealthRecord;
