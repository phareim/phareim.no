import { defineEventHandler, getRouterParam } from 'h3'
import { getJob } from '~/server/utils/job-storage'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'jobId')

  if (!jobId) {
    return {
      error: 'Job ID is required',
      status: 400
    }
  }

  const job = getJob(jobId)

  if (!job) {
    return {
      error: 'Job not found',
      status: 404
    }
  }

  // Return job status
  return {
    jobId: job.id,
    status: job.status,
    imageUrl: job.imageUrl,
    variedPrompt: job.variedPrompt,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt
  }
})
