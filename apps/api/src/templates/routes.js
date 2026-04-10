const express = require("express");
const { createTemplatesRepository } = require("./repository");

const router = express.Router();
const templatesRepository = createTemplatesRepository();

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("API error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  };
}

router.get("/", withErrorHandling(async (_req, res) => {
  const templates = await templatesRepository.listTemplates();
  res.json({
    data: templates,
  });
}));

router.get("/:id", withErrorHandling(async (req, res) => {
  const template = await templatesRepository.getTemplate(req.params.id);

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.json({
    data: template,
  });
}));

router.post("/", withErrorHandling(async (req, res) => {
  const template = req.body;
  
  if (!template.id) {
    template.id = `template-${Date.now()}`;
  }

  const result = await templatesRepository.createTemplate(template);
  res.status(201).json({
    data: result,
  });
}));

router.delete("/:id", withErrorHandling(async (req, res) => {
  const success = await templatesRepository.deleteTemplate(req.params.id);
  
  if (!success) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.status(204).end();
}));

module.exports = {
  templatesRouter: router,
};
