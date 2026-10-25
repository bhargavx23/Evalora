import { Request, Response } from 'express';
import { College } from '../models/College.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Assessment } from '../models/Assessment.js';

export async function getColleges(req: Request, res: Response): Promise<void> {
  try {
    const isPlatformAdmin = req.user?.role === 'platform_admin';
    const filter: any = {};

    if (!isPlatformAdmin) {
      filter.status = 'active';
    }

    const colleges = await College.find(filter).sort({ name: 1 });

    // If platform admin, aggregate statistics for each college
    if (isPlatformAdmin) {
      const collegesWithStats = await Promise.all(
        colleges.map(async col => {
          const [deptCount, facultyCount, studentCount, assessmentCount] = await Promise.all([
            Department.countDocuments({ collegeId: col._id }),
            User.countDocuments({ collegeId: col._id, role: 'faculty' }),
            User.countDocuments({ collegeId: col._id, role: 'student' }),
            Assessment.countDocuments({ collegeId: col._id })
          ]);
          return {
            ...col.toObject(),
            stats: {
              departments: deptCount,
              faculty: facultyCount,
              students: studentCount,
              assessments: assessmentCount
            }
          };
        })
      );
      res.json({ success: true, colleges: collegesWithStats });
      return;
    }

    res.json({ success: true, colleges });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCollegeById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const college = await College.findById(id);
    if (!college) {
      res.status(404).json({ success: false, message: 'College not found' });
      return;
    }

    const departments = await Department.find({ collegeId: college._id });
    res.json({ success: true, college, departments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createCollege(req: Request, res: Response): Promise<void> {
  try {
    const { name, code, domain, contactEmail, phone, address, settings } = req.body;
    const existing = await College.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, message: 'College code already in use' });
      return;
    }

    const college = await College.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      domain: domain?.trim().toLowerCase(),
      contactEmail: contactEmail.trim().toLowerCase(),
      phone,
      address,
      settings: settings || {
        allowRegistration: true,
        requireDepartment: true,
        defaultDurationMinutes: 60,
        antiCheatDefaults: {
          tabSwitchLimit: 3,
          fullscreenRequired: true,
          copyPasteRestricted: true
        }
      }
    });

    res.status(201).json({ success: true, message: 'College created successfully', college });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateCollege(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const college = await College.findByIdAndUpdate(id, updates, { new: true });
    if (!college) {
      res.status(404).json({ success: false, message: 'College not found' });
      return;
    }

    res.json({ success: true, message: 'College updated successfully', college });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function toggleCollegeStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const college = await College.findById(id);
    if (!college) {
      res.status(404).json({ success: false, message: 'College not found' });
      return;
    }

    college.status = college.status === 'active' ? 'suspended' : 'active';
    await college.save();

    res.json({
      success: true,
      message: `College has been ${college.status}`,
      status: college.status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
