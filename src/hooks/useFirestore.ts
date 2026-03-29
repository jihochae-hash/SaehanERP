import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type QueryConstraint } from 'firebase/firestore'
import * as firestoreService from '@/services/firestore.service'
import { useAuthStore } from '@/stores/auth'

/** 단일 문서 조회 훅 */
export function useDocument<T>(collectionName: string, docId: string | undefined) {
  return useQuery({
    queryKey: [collectionName, docId],
    queryFn: () => firestoreService.getDocument<T>(collectionName, docId!),
    enabled: !!docId,
  })
}

/** 컬렉션 조회 훅 */
export function useCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  queryKeyExtra?: unknown[],
) {
  return useQuery({
    queryKey: [collectionName, 'list', ...(queryKeyExtra ?? [])],
    queryFn: () => firestoreService.getDocuments<T>(collectionName, constraints),
  })
}

/** 문서 생성 뮤테이션 */
export function useCreateDocument(collectionName: string) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      firestoreService.createDocument(collectionName, data, user?.uid ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] })
    },
  })
}

/** 문서 수정 뮤테이션 */
export function useUpdateDocument(collectionName: string) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ docId, data }: { docId: string; data: Record<string, unknown> }) =>
      firestoreService.updateDocument(collectionName, docId, data, user?.uid ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] })
    },
  })
}

/** 문서 삭제 뮤테이션 */
export function useDeleteDocument(collectionName: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (docId: string) => firestoreService.deleteDocument(collectionName, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] })
    },
  })
}
