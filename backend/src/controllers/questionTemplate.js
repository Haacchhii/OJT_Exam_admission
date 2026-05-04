import { prisma } from '../db.js';
import { validateSchema } from '../utils/schemas.js';

/**
 * List question templates for current teacher
 */
export const getQuestionTemplates = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can access question templates' });
    }

    const templates = await prisma.questionTemplate.findMany({
      where: {
        createdById: userId,
      },
      select: {
        id: true,
        title: true,
        questionText: true,
        questionType: true,
        points: true,
        description: true,
        choices: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse choices JSON
    const parsed = templates.map(t => ({
      ...t,
      choices: JSON.parse(t.choices),
    }));

    res.json(parsed);
  } catch (err) {
    console.error('Error fetching question templates:', err);
    res.status(500).json({ error: 'Failed to fetch question templates' });
  }
};

/**
 * Save a question as a template
 */
export const saveQuestionTemplate = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can save question templates' });
    }

    const { title, questionText, questionType, points, choices, identificationAnswer, identificationMatchMode, description } = req.body;

    if (!title?.trim() || !questionText?.trim()) {
      return res.status(400).json({ error: 'Title and question text are required' });
    }

    const template = await prisma.questionTemplate.create({
      data: {
        createdById: userId,
        title: title.trim(),
        questionText: questionText.trim(),
        questionType,
        points: points || 1,
        choices: JSON.stringify(choices || []),
        identificationAnswer: identificationAnswer || null,
        identificationMatchMode: identificationMatchMode || null,
        description: description?.trim() || null,
      },
      select: {
        id: true,
        title: true,
        questionText: true,
        questionType: true,
        points: true,
        description: true,
        choices: true,
        createdAt: true,
      },
    });

    // Parse choices JSON
    template.choices = JSON.parse(template.choices);

    res.status(201).json(template);
  } catch (err) {
    console.error('Error saving question template:', err);
    res.status(500).json({ error: 'Failed to save question template' });
  }
};

/**
 * Delete a question template
 */
export const deleteQuestionTemplate = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can delete question templates' });
    }

    const { templateId } = req.params;
    const id = parseInt(templateId, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Check ownership
    const template = await prisma.questionTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Question template not found' });
    }

    if (template.createdById !== userId) {
      return res.status(403).json({ error: 'You can only delete your own templates' });
    }

    await prisma.questionTemplate.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Question template deleted' });
  } catch (err) {
    console.error('Error deleting question template:', err);
    res.status(500).json({ error: 'Failed to delete question template' });
  }
};
