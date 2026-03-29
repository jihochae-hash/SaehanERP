import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import type { BaseDocument } from '@/types'

/** 게시글 카테고리 */
type PostCategory = 'notice' | 'free' | 'department'

const CATEGORY_BADGE: Record<PostCategory, { label: string; color: 'red' | 'blue' | 'green' }> = {
  notice: { label: '공지', color: 'red' },
  free: { label: '자유', color: 'blue' },
  department: { label: '부서', color: 'green' },
}

const CATEGORY_OPTIONS = [
  { value: 'notice', label: '공지' },
  { value: 'free', label: '자유' },
  { value: 'department', label: '부서' },
]

/** 게시글 (posts 컬렉션) */
interface Post extends BaseDocument {
  title: string
  content: string
  category: PostCategory
  authorName: string
  authorDepartment: string
  isPinned: boolean
  viewCount: number
}

interface PostForm {
  title: string
  content: string
  category: PostCategory
  authorName: string
  authorDepartment: string
  isPinned: boolean
}

export default function NoticeBoardPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const user = useAuthStore((s) => s.user)
  const displayName = user?.displayName ?? ''

  const { data: posts = [], isLoading } = useCollection<Post>('posts', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('posts')
  const updateMutation = useUpdateDocument('posts')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PostForm>()

  const openCreate = () => {
    setEditing(null)
    reset({
      title: '', content: '', category: 'free',
      authorName: displayName, authorDepartment: '', isPinned: false,
    })
    setModalOpen(true)
  }

  const openEdit = (post: Post) => {
    setEditing(post)
    reset({
      title: post.title, content: post.content, category: post.category,
      authorName: post.authorName, authorDepartment: post.authorDepartment,
      isPinned: post.isPinned,
    })
    setModalOpen(true)
  }

  const onSave = async (data: PostForm) => {
    const payload = {
      title: data.title,
      content: data.content,
      category: data.category,
      authorName: data.authorName,
      authorDepartment: data.authorDepartment,
      isPinned: data.isPinned,
      viewCount: editing?.viewCount ?? 0,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  /** 필터링 후 고정글을 상위로 정렬 */
  const filtered = posts
    .filter((p) => {
      const matchSearch = p.title.includes(search) || p.authorName.includes(search)
      const matchCategory = !categoryFilter || p.category === categoryFilter
      return matchSearch && matchCategory
    })
    .sort((a, b) => {
      // 고정글 우선
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

  const columns = [
    {
      key: 'isPinned', label: '', width: '40px',
      render: (val: unknown) => val ? <span className="text-red-500 font-bold text-lg">*</span> : null,
    },
    {
      key: 'category', label: '분류', width: '80px',
      render: (val: unknown) => {
        const info = CATEGORY_BADGE[val as PostCategory]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    {
      key: 'title', label: '제목',
      render: (val: unknown, row: Post) => (
        <span className={row.isPinned ? 'font-bold' : ''}>{String(val)}</span>
      ),
    },
    { key: 'authorName', label: '작성자', width: '100px' },
    { key: 'authorDepartment', label: '부서', width: '100px' },
    {
      key: 'viewCount', label: '조회수', width: '80px',
      render: (val: unknown) => formatNumber(val as number),
    },
    { key: 'createdAt', label: '작성일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: Post) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">게시판</h1>
        <Button onClick={openCreate}>글 작성</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="제목, 작성자 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-32">
            <Select
              options={[{ value: '', label: '전체 분류' }, ...CATEGORY_OPTIONS]}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="게시글이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '글 수정' : '글 작성'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="분류" options={CATEGORY_OPTIONS} {...register('category')} />
            <Input label="작성자" {...register('authorName')} />
          </div>
          <Input label="부서" {...register('authorDepartment')} />
          <Input label="제목 *" error={errors.title?.message} {...register('title', { required: '필수' })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[160px]"
              {...register('content', { required: '필수' })}
            />
            {errors.content?.message && <p className="text-sm text-red-500 mt-1">{errors.content.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPinned" {...register('isPinned')} className="rounded border-gray-300" />
            <label htmlFor="isPinned" className="text-sm text-gray-700">상단 고정</label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '작성'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
