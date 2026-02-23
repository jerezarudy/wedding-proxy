import "dotenv/config";
import express from "express";
import { createClient } from "redis";
import cors from "cors";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

const app = express();
app.use(express.json());

// OR allow a single origin (recommended)
app.use(cors());

const redisPassword =
  process.env.REDIS_PASSWORD || "xUC0ZneFaNLRAJldOTd1qGPAmvwb1Ksh";
if (!process.env.REDIS_PASSWORD) {
  console.warn("REDIS_PASSWORD not set; using fallback from source code.");
}

const client = createClient({
  username: process.env.REDIS_USERNAME || "default",
  password: redisPassword,
  socket: {
    host:
      process.env.REDIS_HOST ||
      "redis-18237.c256.us-east-1-2.ec2.redns.redis-cloud.com",
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 18237,
  },
});
await client.connect();

app.get("/get/:key", async (req, res) => {
  try {
    console.log("test");
    const key = req.params.key;
    const v = await client.json.get(key);

    let id = req.query.id;
    let data;
    if (id == "all") {
      data = v;
    } else {
      data = v.find((item) => item.id == id);
    }

    if (!data) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error in /get/:key", error);
    res.status(500).json({ error: "Internal Server Error." });
  }
});
app.post("/set/:key", async (req, res) => {
  try {
    console.log("post");
    const key = req.params.key;
    const v = await client.json.get(key);

    let data = v.find((item) => item.id == req.body.id);

    let isUpdate = false;
    // if found update if not found add
    if (data) {
      data = { ...data, ...req.body };
      const index = v.findIndex((item) => item.id == req.body.id);
      v[index] = data;
      isUpdate = true;
    } else {
      v.push(req.body);
    }

    //   const { key, value } = req.body;
    await client.json.set(key, "$", v);
    let message = isUpdate
      ? "Data updated successfully."
      : "Data added successfully.";
    res.status(200).json({ message });
  } catch (error) {
    console.error("Error in /set/:key", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/delete/:key", async (req, res) => {
  try {
    console.log("post");
    const key = req.params.key;
    let v = await client.json.get(key);

    let data = v.find((item) => item.id == req.body.id);

    let finalData = v.filter((item) => item.id != req.body.id);

    let isUpdate = false;
    // if found update if not found add
    if (data) {
      v = finalData;
    }

    //   const { key, value } = req.body;
    await client.json.set(key, "$", v);
    let message = "Data deleted successfully.";
    res.status(200).json({ message });
  } catch (error) {
    console.error("Error in /set/:key", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/s3-sign", async (req, res) => {
  try {
    const { fileName, fileType, folder } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: "Missing file info" });
    }

    const ext = fileName.split(".").pop();
    const key = `${folder || "uploads"}/${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60,
    });

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log({ uploadUrl, fileUrl, key });

    res.json({
      uploadUrl,
      fileUrl,
      key,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sign url" });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("listening"));
