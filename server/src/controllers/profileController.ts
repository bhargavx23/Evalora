import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Resume } from '../models/Resume.js';
import { resumeStorageService } from '../services/resumeStorageService.js';

const allowedMimeTypes = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const extensionForMime: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};
const knownSkills = ['javascript', 'typescript', 'react', 'node.js', 'node', 'python', 'java', 'c++', 'sql', 'mongodb', 'docker', 'aws', 'git', 'rest', 'graphql', 'css', 'html'];
const avatarTypes: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

function userId(req: Request): mongoose.Types.ObjectId { return new mongoose.Types.ObjectId(req.user!._id); }
function completion(profile: any, resume: any): { percentage: number; missing: string[] } {
  const checks: Array<[string, boolean]> = [
    ['Professional headline', Boolean(profile?.headline)],
    ['Short bio', Boolean(profile?.bio)],
    ['Education', Boolean(profile?.degree && profile?.branch && profile?.graduationYear)],
    ['Skills', Boolean(profile?.skills?.length || profile?.programmingLanguages?.length)],
    ['Projects', Boolean(profile?.projects?.length)],
    ['Certifications', Boolean(profile?.certifications?.length)],
    ['GitHub or coding profile', Boolean(profile?.links?.length)],
    ['Resume', Boolean(resume)]
  ];
  const completed = checks.filter(([, value]) => value).length;
  return { percentage: Math.round((completed / checks.length) * 100), missing: checks.filter(([, value]) => !value).map(([label]) => label) };
}

export async function getStudentProfile(req: Request, res: Response): Promise<void> {
  try {
    const [user, profile, resume] = await Promise.all([
      User.findById(req.user!._id)
        .select('name email phone role collegeId departmentId studentId employeeId avatar emailVerified walletAddress wallets authProviders plan status freeAttempts paidAttempts createdAt')
        .populate('collegeId', 'name code')
        .populate('departmentId', 'name code'),
      StudentProfile.findOne({ userId: userId(req) }),
      Resume.findOne({ userId: userId(req) }).sort({ createdAt: -1 }).select('-extractedText')
    ]);
    if (!user) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    const progress = completion(profile, resume);
    res.json({ success: true, user, profile, resume, completion: progress });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
}

export async function updateStudentProfile(req: Request, res: Response): Promise<void> {
  try {
    const body = { ...req.body };
    delete body.userId; delete body.collegeId;

    if (body.name || body.phone !== undefined) {
      const userUpdates: Record<string, any> = {};
      if (typeof body.name === 'string' && body.name.trim()) userUpdates.name = body.name.trim();
      if (typeof body.phone === 'string') userUpdates.phone = body.phone.trim();
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(userId(req), { $set: userUpdates });
      }
    }

    const profile = await StudentProfile.findOneAndUpdate(
      { userId: userId(req) },
      { $set: { ...body, collegeId: req.user?.collegeId || null, userId: userId(req) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, profile, completion: completion(profile, await Resume.exists({ userId: userId(req) })) });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message }); }
}

export async function uploadResume(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file || !allowedMimeTypes.has(file.mimetype)) { res.status(400).json({ success: false, message: 'Only PDF and DOCX resumes are supported.' }); return; }
    const extension = extensionForMime[file.mimetype];
    let extractedText = '';
    if (file.mimetype === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      extractedText = (await pdfParse(file.buffer)).text;
    } else {
      const mammoth = await import('mammoth');
      extractedText = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    }
    if (!extractedText.trim()) { res.status(422).json({ success: false, message: 'The uploaded document has no readable text.' }); return; }
    const storageKey = await resumeStorageService.save(file.buffer, extension);
    const previous = await Resume.findOne({ userId: userId(req) }).sort({ createdAt: -1 });
    if (previous) await resumeStorageService.remove(previous.storageKey);
    const resume = await Resume.findOneAndUpdate(
      { userId: userId(req) },
      { userId: userId(req), collegeId: req.user?.collegeId || null, originalName: file.originalname, storageKey, mimeType: file.mimetype, sizeBytes: file.size, extractedText, analysis: undefined },
      { upsert: true, new: true, runValidators: true }
    ).select('-extractedText');
    res.status(201).json({ success: true, resume, message: 'Resume uploaded successfully.' });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message || 'Resume upload failed.' }); }
}

export async function deleteResume(req: Request, res: Response): Promise<void> {
  try {
    const resume = await Resume.findOneAndDelete({ userId: userId(req) });
    if (resume) await resumeStorageService.remove(resume.storageKey);
    res.json({ success: true, message: 'Resume removed.' });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
}

export async function downloadResume(req: Request, res: Response): Promise<void> {
  try {
    const resume = await Resume.findOne({ userId: userId(req) });
    if (!resume) { res.status(404).json({ success: false, message: 'Resume not found' }); return; }
    const file = await resumeStorageService.read(resume.storageKey);
    res.type(resume.mimeType).setHeader('Content-Disposition', `inline; filename="${resume.originalName.replace(/[^a-z0-9._-]/gi, '_')}"`).send(file);
  } catch (error: any) { res.status(404).json({ success: false, message: 'Resume file is unavailable.' }); }
}

export async function analyzeResume(req: Request, res: Response): Promise<void> {
  try {
    const resume = await Resume.findOne({ userId: userId(req) }).select('+extractedText');
    if (!resume) { res.status(404).json({ success: false, message: 'Upload a resume before analyzing it.' }); return; }
    const text = resume.extractedText.toLowerCase();
    const sections = ['experience', 'education', 'skills', 'projects', 'certifications', 'summary'].filter(section => text.includes(section));
    const detectedSkills = knownSkills.filter(skill => text.includes(skill));
    const recommendations: any[] = [];
    if (!text.includes('email') && !/@/.test(text)) recommendations.push({ category: 'Contact information', problem: 'No email address was detected.', whyItMatters: 'Recruiters and parsers need a reliable contact channel.', recommendation: 'Add a professional email address in the header.', priority: 'high' });
    if (!sections.includes('skills')) recommendations.push({ category: 'Skills', problem: 'A skills section was not detected.', whyItMatters: 'ATS parsers use explicit skills headings to map keywords.', recommendation: 'Add a clearly labeled Skills section.', priority: 'high' });
    if (!sections.includes('projects') && !sections.includes('experience')) recommendations.push({ category: 'Experience', problem: 'Projects or experience were not detected.', whyItMatters: 'Evidence of applied work helps recruiters assess relevance.', recommendation: 'Add projects or experience with specific technologies and outcomes.', priority: 'high' });
    if (!/\b(led|built|developed|implemented|designed|improved|created)\b/.test(text)) recommendations.push({ category: 'Content', problem: 'Few strong action verbs were detected.', whyItMatters: 'Action-oriented bullets are easier to scan and evaluate.', recommendation: 'Start bullets with accurate action verbs such as built, implemented, or designed.', priority: 'medium' });
    if (!/\d+%|\d+\+|\$\d+|\b\d+ users?\b/.test(text)) recommendations.push({ category: 'Achievements', problem: 'No measurable outcomes were detected.', whyItMatters: 'Specific outcomes make achievements more credible.', recommendation: 'Add metrics only where you can verify them.', priority: 'medium' });
    const breakdown = { formatting: sections.length >= 4 ? 20 : sections.length * 4, keywords: Math.min(20, detectedSkills.length * 2), skills: sections.includes('skills') ? 15 : 5, experience: sections.includes('experience') ? 15 : 5, projects: sections.includes('projects') ? 10 : 3, achievements: /\d+%|\d+\+/.test(text) ? 10 : 4, contact: /@/.test(text) ? 5 : 1 };
    const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0)));
    resume.analysis = { score, scoreBreakdown: breakdown, detectedSections: sections, detectedSkills, recommendations, matchedKeywords: [], missingKeywords: [], analyzedAt: new Date() };
    await resume.save();
    res.json({ success: true, message: "Evalora's ATS compatibility estimate is based on the uploaded document's structure and text.", analysis: resume.analysis });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file || !avatarTypes[file.mimetype]) { res.status(400).json({ success: false, message: 'Profile pictures must be PNG, JPEG, or WebP.' }); return; }
    const user = await User.findById(req.user!._id).select('avatar');
    const key = await resumeStorageService.saveAvatar(file.buffer, avatarTypes[file.mimetype]);
    if (user?.avatar) await resumeStorageService.removeAvatar(user.avatar);
    await User.findByIdAndUpdate(req.user!._id, { avatar: key });
    res.status(201).json({ success: true, avatar: `/api/profile/avatar/${key}` });
  } catch (error: any) { res.status(400).json({ success: false, message: error.message || 'Profile picture upload failed.' }); }
}

export async function getAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!._id).select('avatar');
    if (!user?.avatar) { res.status(404).end(); return; }
    const file = await resumeStorageService.readAvatar(user.avatar);
    res.type(pathExtension(user.avatar)).send(file);
  } catch { res.status(404).end(); }
}

export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!._id).select('avatar');
    if (user?.avatar) await resumeStorageService.removeAvatar(user.avatar);
    await User.findByIdAndUpdate(req.user!._id, { $unset: { avatar: 1 } });
    res.json({ success: true, message: 'Profile picture removed.' });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
}

function pathExtension(name: string): string { return name.endsWith('.png') ? 'png' : name.endsWith('.webp') ? 'webp' : 'jpeg'; }
