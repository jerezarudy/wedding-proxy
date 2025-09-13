import express from "express";
import { createClient } from "redis";

const app = express();
app.use(express.json());

const client = createClient({
  username: "default",
  password: "xUC0ZneFaNLRAJldOTd1qGPAmvwb1Ksh",
  socket: {
    host: "redis-18237.c256.us-east-1-2.ec2.redns.redis-cloud.com",
    port: 18237,
  },
});
await client.connect();

app.get("/get/:key", async (req, res) => {
  try {
    const v = await client.json.get(req.params.key);

    let data = v.find((item) => item.id == req.query.id);

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

app.listen(process.env.PORT || 3000, () => console.log("listening"));
