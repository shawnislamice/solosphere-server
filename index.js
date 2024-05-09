const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// Middleware
const corsConfig = {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsConfig));
app.use(express.json());
app.use(cookieParser());
// Middleware

// Database

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ipcjhor.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// Our Middlewares
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  console.log("Middleware", token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if (error) {
        return res.status(401).send({ message: "Unauthorized Access" });
        // return
      }
      console.log(decoded);
      req.user = decoded;
      next();
    });
  }
  // next();
};
// Our Middlewares

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const jobsCollection = client
      .db("NewSolosphereDB")
      .collection("solosphereJOBS");
    const bidJobsCollection = client
      .db("NewSolosphereDB")
      .collection("solosphereBIDJOBS");
    const usersCollection = client
      .db("NewSolosphereDB")
      .collection("solosphereUSERS");

    // Auth Related Token API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      // console.log(process.env.ACCESS_TOKEN_SECRET);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      // console.log(token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });
    // Auth Related Token API

    app.get("/alljobs", async (req, res) => {
      const alljobs = await jobsCollection.find().toArray();
      // console.log("Token", req.cookies.token);
      console.log("Valid User", req.user);
      res.send(alljobs);
    });

    app.post("/alljobs", async (req, res) => {
      const job = req.body;
      const result = await jobsCollection.insertOne(job);
      res.send(result);
    });
    app.get("/alljobs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);
      res.send(job);
    });
    app.get("/alljobss/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.user.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { "buyer.email": email };
      const bidJobs = await jobsCollection.find(query).toArray();
      res.send(bidJobs);
    });
    app.delete("/alljobs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });
    app.put("/alljobs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedData = {
        $set: {
          ...jobData,
        },
      };
      const result = await jobsCollection.updateOne(
        query,
        updatedData,
        options
      );
      res.send(result);
    });
    app.get("/bidjobs", verifyToken, async (req, res) => {
      const bidJobs = await bidJobsCollection.find().toArray();
      res.send(bidJobs);
    });
    app.post("/bidjobs", verifyToken, async (req, res) => {
      const bidJob = req.body;
      // Check is it duplicate
      const alreadyApplied = await bidJobsCollection.findOne({
        email: bidJob.email,
        title: bidJob.title,
      });
      if (alreadyApplied) {
        return res.status(400).send("You have already placed on this job");
      }
      const result = await bidJobsCollection.insertOne(bidJob);

      res.send(result);
    });
    app.get("/bidjobs/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.user.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { email: email };
      const bidJobs = await bidJobsCollection.find(query).toArray();
      res.send(bidJobs);
    });

    app.get("/bidrequests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.user.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { "buyer.email": email };
      const ownerJobs = await bidJobsCollection.find(query).toArray();
      res.send(ownerJobs);
    });
    // Update Status
    app.patch("/bidjobs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: status,
      };
      const result = await bidJobsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // Find Total; Data Coutn
    app.get("/alljobscount", async (req, res) => {
      const filter = req.query.filter;
      let query = {};
      if (filter) {
        query = {
          category: filter,
        };
      }
      const result = await jobsCollection.countDocuments();
      res.send({ result });
    });
    app.get("/newalljobs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      const sort = req.query.sort;
      let options = {};
      let query = {};

      if (sort) {
        options = {
          sort: { deadline: sort === "asc" ? 1 : -1 },
        };
      }

      if (filter) {
        query = {
          category: filter,
        };
      }

      console.log(size, page);
      const result = await jobsCollection
        .find(query,options)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Database

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
