import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate, formatNumber } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import type { BaseDocument } from '@/types'

/** 파일 유형별 아이콘/라벨 */
const FILE_TYPE_INFO: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'PDF', color: 'text-red-600' },
  doc: { icon: 'DOC', color: 'text-blue-600' },
  docx: { icon: 'DOC', color: 'text-blue-600' },
  xls: { icon: 'XLS', color: 'text-green-600' },
  xlsx: { icon: 'XLS', color: 'text-green-600' },
  ppt: { icon: 'PPT', color: 'text-orange-600' },
  pptx: { icon: 'PPT', color: 'text-orange-600' },
  jpg: { icon: 'IMG', color: 'text-purple-600' },
  jpeg: { icon: 'IMG', color: 'text-purple-600' },
  png: { icon: 'IMG', color: 'text-purple-600' },
  zip: { icon: 'ZIP', color: 'text-yellow-600' },
  hwp: { icon: 'HWP', color: 'text-sky-600' },
}

/** 파일 크기 포맷 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** 공유 파일 (sharedFiles 컬렉션) */
interface SharedFile extends BaseDocument {
  fileName: string
  fileSize: number
  fileType: string
  uploadedBy: string
  uploadedByName: string
  department: string
  description?: string
  downloadCount: number
}

interface FileForm {
  fileName: string
  fileSize: string
  fileType: string
  uploadedByName: string
  department: string
  description: string
}

export default function FileSharePage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SharedFile | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const user = useAuthStore((s) => s.user)
  const displayName = user?.displayName ?? ''
  const uid = user?.uid ?? ''

  const { data: files = [], isLoading } = useCollection<SharedFile>('sharedFiles', [orderBy('createdAt', 'desc')], ['all'])
  const createMutation = useCreateDocument('sharedFiles')
  const updateMutation = useUpdateDocument('sharedFiles')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FileForm>()

  /** 파일 확장자 목록 (필터용) */
  const fileTypes = Array.from(new Set(files.map((f) => f.fileType.toLowerCase()))).sort()

  const openCreate = () => {
    setEditing(null)
    reset({
      fileName: '', fileSize: '', fileType: '',
      uploadedByName: displayName, department: '', description: '',
    })
    setModalOpen(true)
  }

  const openEdit = (file: SharedFile) => {
    setEditing(file)
    reset({
      fileName: file.fileName, fileSize: String(file.fileSize),
      fileType: file.fileType, uploadedByName: file.uploadedByName,
      department: file.department, description: file.description ?? '',
    })
    setModalOpen(true)
  }

  const onSave = async (data: FileForm) => {
    const payload = {
      fileName: data.fileName,
      fileSize: Number(data.fileSize) || 0,
      fileType: data.fileType.toLowerCase(),
      uploadedBy: editing?.uploadedBy ?? uid,
      uploadedByName: data.uploadedByName,
      department: data.department,
      description: data.description || null,
      downloadCount: editing?.downloadCount ?? 0,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = files.filter((f) => {
    const matchSearch =
      f.fileName.toLowerCase().includes(search.toLowerCase()) ||
      f.uploadedByName.includes(search) ||
      f.department.includes(search)
    const matchType = !typeFilter || f.fileType.toLowerCase() === typeFilter
    return matchSearch && matchType
  })

  const columns = [
    {
      key: 'fileType', label: '유형', width: '60px',
      render: (val: unknown) => {
        const ext = String(val).toLowerCase()
        const info = FILE_TYPE_INFO[ext]
        return (
          <span className={`font-bold text-xs ${info?.color ?? 'text-gray-500'}`}>
            {info?.icon ?? ext.toUpperCase()}
          </span>
        )
      },
    },
    {
      key: 'fileName', label: '파일명',
      render: (val: unknown) => <span className="font-medium">{String(val)}</span>,
    },
    {
      key: 'fileSize', label: '크기', width: '100px',
      render: (val: unknown) => formatFileSize(val as number),
    },
    { key: 'uploadedByName', label: '업로드', width: '100px' },
    { key: 'department', label: '부서', width: '100px' },
    { key: 'description', label: '설명', render: (val: unknown) => val ? String(val) : '-' },
    {
      key: 'downloadCount', label: '다운로드', width: '80px',
      render: (val: unknown) => formatNumber(val as number),
    },
    { key: 'createdAt', label: '업로드일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: SharedFile) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">파일공유</h1>
        <Button onClick={openCreate}>파일 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="파일명, 업로드자, 부서 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {fileTypes.length > 0 && (
            <div className="w-32">
              <Select
                options={[
                  { value: '', label: '전체 유형' },
                  ...fileTypes.map((t) => ({ value: t, label: t.toUpperCase() })),
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          )}
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="공유된 파일이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '파일 수정' : '파일 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <Input label="파일명 *" error={errors.fileName?.message} {...register('fileName', { required: '필수' })} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="파일크기 (bytes)" type="number" {...register('fileSize')} />
            <Input label="파일유형 (확장자) *" placeholder="pdf, xlsx, hwp..." error={errors.fileType?.message} {...register('fileType', { required: '필수' })} />
            <Input label="업로드자" {...register('uploadedByName')} />
          </div>
          <Input label="부서" {...register('department')} />
          <Input label="설명" {...register('description')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editing ? '수정' : '등록'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
