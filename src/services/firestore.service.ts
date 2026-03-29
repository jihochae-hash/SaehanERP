import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type DocumentData,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'

/** 단일 문서 조회 */
export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, docId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

/** 컬렉션 조회 (필터/정렬/페이지네이션) */
export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

/** 문서 생성 */
export async function createDocument(
  collectionName: string,
  data: DocumentData,
  userId: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
  return docRef.id
}

/** 문서 수정 */
export async function updateDocument(
  collectionName: string,
  docId: string,
  data: DocumentData,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

/** 문서 삭제 */
export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, docId))
}

// 편의 re-export
export { where, orderBy, limit, startAfter }
