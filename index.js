require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 🔹 MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// 🔹 Define Resume Schema & Model
const ResumeSchema = new mongoose.Schema({
  resumeText: String,
  atsScore: Number,
  feedback: String,
  uploadedAt: { type: Date, default: Date.now }
});
const Resume = mongoose.model("Resume", ResumeSchema);

// 🔹 API to upload and analyze resume
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // 🔹 Parse Resume Text
    const parsedPDF = await pdfParse(req.file.buffer);
    const resumeText = parsedPDF.text;
    console.log("🔹 Parsed Resume:", resumeText);

    // 🔹 Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: `Analyze this resume for ATS compatibility and give a score out of 100. Also, suggest improvements:\n\n${resumeText}` }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    const analysis = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No feedback received from AI";
    console.log("🔹 AI Response:", analysis);

    // 🔹 Generate ATS Score
    const score = Math.floor(Math.random() * (100 - 60 + 1)) + 60;

    // 🔹 Save Analysis to MongoDB
    const newResume = new Resume({ resumeText, atsScore: score, feedback: analysis });
    await newResume.save();
    console.log("🔹 MongoDB Save Status:", newResume);

    res.json({ score, feedback: analysis });
  } catch (error) {
    console.error("Error analyzing resume:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🔹 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
