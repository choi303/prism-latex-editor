import mongoose, { Schema } from "mongoose";

const assistantTurnSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    summary: {
      type: String,
      default: ""
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const latexProjectSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    latex: {
      type: String,
      required: true
    },
    assistantHistory: {
      type: [assistantTurnSchema],
      default: []
    },
    lastCompiledHash: {
      type: String,
      default: null
    },
    lastCompiledAt: {
      type: Date,
      default: null
    },
    lastAssistantSummary: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const LatexProjectModel =
  mongoose.models.LatexProject || mongoose.model("LatexProject", latexProjectSchema);