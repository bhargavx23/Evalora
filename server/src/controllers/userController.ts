import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.query;
    const filter: Record<string, any> = {};

    if (req.user?.role !== 'platform_admin') {
      if (!req.user?.collegeId) {
        res.status(400).json({ success: false, message: 'College ID is required' });
        return;
      }
      filter.collegeId = new mongoose.Types.ObjectId(req.user.collegeId);
    }

    if (role && role !== 'all') {
      filter.role = role;
    } else {
      filter.role = { $in: ['college_admin', 'faculty', 'student'] };
    }

    const users = await User.find(filter)
      .select('name email role collegeId departmentId studentId employeeId status createdAt')
      .populate('departmentId', 'name code')
      .populate('collegeId', 'name code')
      .sort({ role: 1, name: 1 });

    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
