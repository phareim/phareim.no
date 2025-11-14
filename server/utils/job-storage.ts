// Simple in-memory job storage
// For production, consider using Redis or Firebase

export interface ImageGenerationJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  basePrompt: string
  width?: number
  height?: number
  imageUrl?: string
  variedPrompt?: string
  error?: string
  createdAt: Date
  completedAt?: Date
}

const jobs = new Map<string, ImageGenerationJob>()

// Clean up old jobs after 1 hour
const JOB_CLEANUP_TIME = 60 * 60 * 1000 // 1 hour
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt.getTime() > JOB_CLEANUP_TIME) {
      jobs.delete(id)
    }
  }
}, 5 * 60 * 1000) // Run cleanup every 5 minutes

export function createJob(basePrompt: string, width?: number, height?: number): ImageGenerationJob {
  const id = generateJobId()
  const job: ImageGenerationJob = {
    id,
    status: 'pending',
    basePrompt,
    width,
    height,
    createdAt: new Date()
  }
  jobs.set(id, job)
  return job
}

export function getJob(id: string): ImageGenerationJob | undefined {
  return jobs.get(id)
}

export function updateJob(id: string, updates: Partial<ImageGenerationJob>): void {
  const job = jobs.get(id)
  if (job) {
    Object.assign(job, updates)
  }
}

function generateJobId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
