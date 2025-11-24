const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");
const { adminOnly } = require("../middleware/auth");

// Get all settings or by category
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};

    const settings = await Settings.find(filter);

    // Convert to key-value object
    const settingsObj = {};
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value;
    });

    res.json(settingsObj);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Get Orthanc credentials (authenticated users only)
router.get("/orthanc-credentials", async (req, res) => {
  try {
    console.log("Fetching Orthanc credentials");
    res.json({
      url: process.env.ORTHANC_URL,
      username: process.env.ORTHANC_USERNAME,
      password: process.env.ORTHANC_PASSWORD,
    });
  } catch (error) {
    console.error("Get Orthanc credentials error:", error);
    res.status(500).json({ error: "Failed to fetch Orthanc credentials" });
  }
});

// Get single setting by key
router.get("/:key", async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key });

    if (!setting) {
      return res.status(404).json({ error: "Setting not found" });
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error("Get setting error:", error);
    res.status(500).json({ error: "Failed to fetch setting" });
  }
});

// Update or create setting (admin only)
router.put("/:key", adminOnly, async (req, res) => {
  try {
    const { value, category, description } = req.body;

    if (!value) {
      return res.status(400).json({ error: "Value is required" });
    }
    const setting = await Settings.findOneAndUpdate(
      { key: req.params.key },
      {
        value,
        category: category || "GENERAL",
        description: description || "",
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    res.json({
      message: "Setting updated successfully",
      setting: {
        key: setting.key,
        value: setting.value,
        category: setting.category,
      },
    });
  } catch (error) {
    console.error("Update setting error:", error);
    res.status(500).json({ error: "Failed to update setting" });
  }
});

// Delete setting (admin only)
router.delete("/:key", adminOnly, async (req, res) => {
  try {
    const setting = await Settings.findOneAndDelete({ key: req.params.key });

    if (!setting) {
      return res.status(404).json({ error: "Setting not found" });
    }

    res.json({ message: "Setting deleted successfully" });
  } catch (error) {
    console.error("Delete setting error:", error);
    res.status(500).json({ error: "Failed to delete setting" });
  }
});

// Initialize default settings (admin only)
router.post("/initialize", adminOnly, async (req, res) => {
  try {
    const defaults = [
      {
        key: "HOSPITAL_NAME",
        value: "l'EPH MAZOUNA",
        category: "REPORT",
        description: "Hospital name displayed in reports",
      },
      {
        key: "FOOTER_TEXT",
        value:
          "Cité Bousrour en face les pompiers Mazouna Relizane   Tel 0779 00 46 56   حي بوسرور مقابل الحماية المدنية مازونة غليزان",
        category: "REPORT",
        description: "Footer text for reports (bilingual)",
      },
    ];

    for (const def of defaults) {
      await Settings.findOneAndUpdate(
        { key: def.key },
        { ...def, updatedBy: req.user.id },
        { upsert: true }
      );
    }

    res.json({ message: "Default settings initialized" });
  } catch (error) {
    console.error("Initialize settings error:", error);
    res.status(500).json({ error: "Failed to initialize settings" });
  }
});

module.exports = router;
