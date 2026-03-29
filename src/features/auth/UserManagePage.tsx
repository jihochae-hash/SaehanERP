import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Select, Badge } from '@/components/ui'
import { useCollection } from '@/hooks/useFirestore'
import { setUserRole } from '@/services/auth.service'
import { ROLE_CONFIG, ROLE_OPTIONS } from '@/constants'
import { useForm } from 'react-hook-form'
import type { UserProfile, UserRole } from '@/types'

interface RoleForm {
  role: UserRole
}

export default function UserManagePage() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: users = [], isLoading, refetch } = useCollection<UserProfile>(
    'users',
    [orderBy('createdAt', 'desc')],
    ['all'],
  )

  const { register, handleSubmit, reset } = useForm<RoleForm>()

  const openRoleModal = (user: UserProfile) => {
    setSelectedUser(user)
    reset({ role: 'staff' })
    setModalOpen(true)
  }

  const onSubmit = async (data: RoleForm) => {
    if (!selectedUser) return
    setLoading(true)
    try {
      const config = ROLE_CONFIG[data.role]
      await setUserRole(selectedUser.uid, data.role, config.modules as string[])
      await refetch()
      setModalOpen(false)
    } catch {
      alert('역할 설정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { key: 'displayName', label: '이름' },
    { key: 'email', label: '이메일' },
    { key: 'department', label: '부서', render: (val: unknown) => val ? String(val) : '—' },
    { key: 'position', label: '직급', render: (val: unknown) => val ? String(val) : '—' },
    {
      key: 'isActive', label: '상태', width: '80px',
      render: (val: unknown) => <Badge color={val ? 'green' : 'red'}>{val ? '활성' : '비활성'}</Badge>,
    },
    {
      key: 'actions', label: '', width: '120px',
      render: (_: unknown, row: UserProfile) => (
        <Button size="sm" variant="ghost" onClick={() => openRoleModal(row)}>역할 설정</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">사용자관리</h1>
      </div>

      <Card>
        <Table columns={columns} data={users} loading={isLoading} emptyMessage="등록된 사용자가 없습니다." />
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={`역할 설정 — ${selectedUser?.displayName ?? ''}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select label="역할 *" options={ROLE_OPTIONS} {...register('role')} />
          <p className="text-xs text-gray-500">
            역할을 변경하면 해당 사용자의 모듈 접근 권한이 즉시 변경됩니다.
            변경된 권한은 다음 로그인 시 적용됩니다.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>설정</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
