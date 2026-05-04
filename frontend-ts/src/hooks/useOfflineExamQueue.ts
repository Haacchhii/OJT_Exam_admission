/**
 * Hook for managing offline exam submission queue.
 * Stores exam state in localStorage when offline and retries when connection restored.
 */

export interface ExamSubmissionQueueItem {
  id: string;
  examId: string | number;
  answers: Record<string, any>;
  timestamp: string;
  attemptCount: number;
}

export function useOfflineExamQueue() {
  const STORAGE_KEY = 'exam_submission_queue';

  const enqueueSubmission = (examId: string | number, answers: Record<string, any>) => {
    try {
      const queue: ExamSubmissionQueueItem[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]'
      );
      queue.push({
        id: `${examId}-${Date.now()}`,
        examId,
        answers,
        timestamp: new Date().toISOString(),
        attemptCount: 0,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to enqueue submission:', error);
    }
  };

  const getQueue = (): ExamSubmissionQueueItem[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (error) {
      console.error('Failed to read queue:', error);
      return [];
    }
  };

  const removeFromQueue = (submissionId: string) => {
    try {
      const queue = getQueue().filter((item) => item.id !== submissionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  };

  const incrementAttemptCount = (submissionId: string) => {
    try {
      const queue = getQueue();
      const item = queue.find((i) => i.id === submissionId);
      if (item) {
        item.attemptCount++;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      console.error('Failed to increment attempt count:', error);
    }
  };

  const clearQueue = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  };

  const getQueueSize = (): number => {
    return getQueue().length;
  };

  return {
    enqueueSubmission,
    getQueue,
    removeFromQueue,
    incrementAttemptCount,
    clearQueue,
    getQueueSize,
  };
}
