import { useState, useRef } from 'react'
import { orderBy } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/utils/format'

// --- 인라인 타입 ---

type ContactType = 'visit' | 'call' | 'email' | 'meeting'
type ContactLogStatus = 'pending' | 'completed'

interface AttachedImage {
  url: string
  name: string
  path: string
}

interface ContactLog {
  id: string
  logDate: string
  partnerId: string
  partnerName: string
  contactType: ContactType
  subject: string
  content: string
  nextAction: string
  assignedTo: string
  status: ContactLogStatus
  images?: AttachedImage[]
  createdAt: unknown
}

interface ContactLogForm {
  logDate: string
  partnerId: string
  partnerName: string
  contactType: ContactType
  subject: string
  content: string
  nextAction: string
  assignedTo: string
  status: ContactLogStatus
}

// --- 상수 ---

const CONTACT_TYPE_BADGE: Record<ContactType, { label: string; color: 'blue' | 'green' | 'yellow' | 'purple' }> = {
  visit: { label: '방문', color: 'blue' },
  call: { label: '전화', color: 'green' },
  email: { label: '이메일', color: 'yellow' },
  meeting: { label: '미팅', color: 'purple' },
}

const STATUS_BADGE: Record<ContactLogStatus, { label: string; color: 'gray' | 'green' }> = {
  pending: { label: '진행중', color: 'gray' },
  completed: { label: '완료', color: 'green' },
}

const CONTACT_TYPE_OPTIONS = [
  { value: 'visit', label: '방문' },
  { value: 'call', label: '전화' },
  { value: 'email', label: '이메일' },
  { value: 'meeting', label: '미팅' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: '진행중' },
  { value: 'completed', label: '완료' },
]

export default function ContactLogPage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ContactLog | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [images, setImages] = useState<AttachedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: logs = [], isLoading } = useCollection<ContactLog>(
    'contactLogs',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )
  const createMutation = useCreateDocument('contactLogs')
  const updateMutation = useUpdateDocument('contactLogs')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactLogForm>()

  const openCreate = () => {
    setEditing(null)
    setImages([])
    reset({
      logDate: '', partnerId: '', partnerName: '',
      contactType: 'call', subject: '', content: '',
      nextAction: '', assignedTo: '', status: 'pending',
    })
    setModalOpen(true)
  }

  const openEdit = (log: ContactLog) => {
    setEditing(log)
    setImages(log.images ?? [])
    reset({
      logDate: log.logDate,
      partnerId: log.partnerId,
      partnerName: log.partnerName,
      contactType: log.contactType,
      subject: log.subject,
      content: log.content,
      nextAction: log.nextAction ?? '',
      assignedTo: log.assignedTo ?? '',
      status: log.status,
    })
    setModalOpen(true)
  }

  /** 이미지 업로드 */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const newImages: AttachedImage[] = []
      for (const file of Array.from(files)) {
        const path = `contactLogs/${Date.now()}_${file.name}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, file)
        const url = await getDownloadURL(storageRef)
        newImages.push({ url, name: file.name, path })
      }
      setImages((prev) => [...prev, ...newImages])
    } catch {
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /** 이미지 삭제 */
  const handleImageDelete = async (img: AttachedImage) => {
    if (!confirm(`"${img.name}" 이미지를 삭제하시겠습니까?`)) return
    try {
      if (img.path) {
        const storageRef = ref(storage, img.path)
        await deleteObject(storageRef).catch(() => {})
      }
      setImages((prev) => prev.filter((i) => i.url !== img.url))
    } catch {
      alert('이미지 삭제에 실패했습니다.')
    }
  }

  const onSave = async (data: ContactLogForm) => {
    const payload = {
      logDate: data.logDate,
      partnerId: data.partnerId || null,
      partnerName: data.partnerName,
      contactType: data.contactType,
      subject: data.subject,
      content: data.content,
      nextAction: data.nextAction || null,
      assignedTo: data.assignedTo || null,
      status: data.status,
      images,
    }
    if (editing) {
      await updateMutation.mutateAsync({ docId: editing.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const filtered = logs.filter((l) => {
    const matchSearch =
      l.partnerName.includes(search) ||
      l.subject.includes(search) ||
      (l.assignedTo ?? '').includes(search)
    const matchType = !typeFilter || l.contactType === typeFilter
    return matchSearch && matchType
  })

  const columns = [
    { key: 'logDate', label: '일자', width: '100px' },
    { key: 'partnerName', label: '거래처' },
    {
      key: 'contactType', label: '유형', width: '90px',
      render: (val: unknown) => {
        const info = CONTACT_TYPE_BADGE[val as ContactType]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'subject', label: '제목' },
    { key: 'assignedTo', label: '담당자', width: '100px' },
    {
      key: 'images', label: '첨부', width: '60px',
      render: (val: unknown) => {
        const imgs = val as AttachedImage[] | undefined
        return imgs && imgs.length > 0 ? <Badge color="blue">{imgs.length}장</Badge> : null
      },
    },
    {
      key: 'status', label: '상태', width: '80px',
      render: (val: unknown) => {
        const info = STATUS_BADGE[val as ContactLogStatus]
        return <Badge color={info?.color ?? 'gray'}>{info?.label ?? val}</Badge>
      },
    },
    { key: 'createdAt', label: '등록일', width: '100px', render: (val: unknown) => formatDate(val) },
    {
      key: 'actions', label: '', width: '80px', sortable: false,
      render: (_: unknown, row: ContactLog) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(row) }}>수정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">연락/활동기록</h1>
        <Button onClick={openCreate}>기록 등록</Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Input placeholder="거래처, 제목, 담당자 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36">
            <Select
              options={[{ value: '', label: '전체 유형' }, ...CONTACT_TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
        <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="연락/활동 기록이 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? '기록 수정' : '기록 등록'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="일자 *" type="date" error={errors.logDate?.message} {...register('logDate', { required: '필수' })} />
            <Input label="거래처명 *" error={errors.partnerName?.message} {...register('partnerName', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="유형 *" options={CONTACT_TYPE_OPTIONS} {...register('contactType')} />
            <Input label="담당자" {...register('assignedTo')} />
            <Select label="상태" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <Input label="제목 *" error={errors.subject?.message} {...register('subject', { required: '필수' })} />
          <Input label="내용" {...register('content')} />
          <Input label="후속조치" {...register('nextAction')} />

          {/* 이미지 첨부/삭제 */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">첨부 이미지</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                  이미지 추가
                </Button>
              </div>
            </div>
            {images.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">첨부된 이미지가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group border rounded-lg overflow-hidden">
                    <img src={img.url} alt={img.name} className="w-full h-28 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleImageDelete(img)}
                        className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-all"
                      >
                        삭제
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 px-2 py-1 truncate">{img.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
