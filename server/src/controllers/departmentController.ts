import { Request, Response } from "express";
import mongoose from "mongoose";
import { Department } from "../models/Department.js";
import { User } from "../models/User.js";

export async function getDepartments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const collegeId =
      req.user && req.user.role !== "platform_admin"
        ? req.user.collegeId
        : req.query.collegeId || req.user?.collegeId;
    if (!collegeId) {
      res
        .status(400)
        .json({ success: false, message: "College ID is required" });
      return;
    }

    const departments = await Department.find({
      collegeId: new mongoose.Types.ObjectId(collegeId.toString()),
    }).sort({ name: 1 });

    const deptsWithStats = await Promise.all(
      departments.map(async (d) => {
        const [facultyCount, studentCount] = await Promise.all([
          User.countDocuments({ departmentId: d._id, role: "faculty" }),
          User.countDocuments({ departmentId: d._id, role: "student" }),
        ]);
        return {
          ...d.toObject(),
          facultyCount,
          studentCount,
        };
      }),
    );

    res.json({ success: true, departments: deptsWithStats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createDepartment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { name, code, description, collegeId } = req.body;
    const targetCollegeId =
      req.user?.role === "platform_admin"
        ? collegeId || req.user.collegeId
        : req.user?.collegeId;

    if (!targetCollegeId) {
      res
        .status(400)
        .json({ success: false, message: "College ID is required" });
      return;
    }

    const existing = await Department.findOne({
      collegeId: new mongoose.Types.ObjectId(targetCollegeId),
      code: code.toUpperCase().trim(),
    });

    if (existing) {
      res
        .status(409)
        .json({
          success: false,
          message: "Department code already exists in this college",
        });
      return;
    }

    const dept = await Department.create({
      collegeId: new mongoose.Types.ObjectId(targetCollegeId),
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description,
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Department created successfully",
        department: dept,
      });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateDepartment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const existing = await Department.findById(id);
    if (
      !existing ||
      (req.user?.role !== "platform_admin" &&
        existing.collegeId.toString() !== req.user?.collegeId)
    ) {
      res.status(404).json({ success: false, message: "Department not found" });
      return;
    }

    const dept = await Department.findByIdAndUpdate(
      existing._id,
      {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.toUpperCase().trim() }),
        ...(description !== undefined && { description }),
      },
      { new: true },
    );

    if (!dept) {
      res.status(404).json({ success: false, message: "Department not found" });
      return;
    }

    res.json({
      success: true,
      message: "Department updated successfully",
      department: dept,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteDepartment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);
    if (
      !department ||
      (req.user?.role !== "platform_admin" &&
        department.collegeId.toString() !== req.user?.collegeId)
    ) {
      res.status(404).json({ success: false, message: "Department not found" });
      return;
    }

    const usersCount = await User.countDocuments({
      departmentId: department._id,
    });
    if (usersCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete department. There are ${usersCount} users assigned to it.`,
      });
      return;
    }

    await Department.findByIdAndDelete(department._id);
    res.json({ success: true, message: "Department deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}
