import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { orderBy } from 'firebase/firestore'
import { Button, Card, Table, Modal, Input, Select, Badge } from '@/components/ui'
import { useDocument, useCollection, useCreateDocument, useUpdateDocument } from '@/hooks/useFirestore'
import { useForm } from 'react-hook-form'
import type { Formula, FormulaIngredient, Ingredient, FormulaStatus, VerificationIssue, Item } from '@/types'

const CATEGORY_OPTIONS = [
  { value: 'skincare', label: '스킨케어' },
  { value: 'makeup', label: '메이크업' },
  { value: 'haircare', label: '헤어케어' },
  { value: 'bodycare', label: '바디케어' },
  { value: 'suncare', label: '선케어' },
  { value: 'cleansing', label: '클렌징' },
  { value: 'other', label: '기타' },
]

const USAGE_TYPE_OPTIONS = [
  { value: 'leave_on', label: 'Leave-on (비씻어내는)' },
  { value: 'rinse_off', label: 'Rinse-off (씻어내는)' },
]

const FORMULA_TYPE_OPTIONS = [
  { value: 'manufacturing', label: '제조처방 — 실제 제조에 사용하는 배합' },
  { value: 'label', label: '표기처방 — 제품 라벨에 표기하는 성분' },
  { value: 'alternative', label: '대체처방 — 원료 수급 등에 따른 대체 배합' },
]

interface FormulaForm {
  code: string
  name: string
  category: string
  usageType: string
  formulaType: string
  linkedProductItemId: string
  description: string
  manufacturingNotes: string
}

interface AddIngredientForm {
  ingredientId: string
  percentage: string
  purpose: string
}

export default function FormulaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const { data: formula } = useDocument<Formula>('formulas', isNew ? undefined : id)
  const { data: allIngredients = [] } = useCollection<Ingredient>('ingredients', [orderBy('nameKo', 'asc')], ['active'])
  const { data: allItems = [] } = useCollection<Item>('items', [orderBy('name', 'asc')], ['active'])
  const { data: allFormulas = [] } = useCollection<Formula>('formulas', [orderBy('createdAt', 'desc')], ['all'])

  const createMutation = useCreateDocument('formulas')
  const updateMutation = useUpdateDocument('formulas')

  const [composition, setComposition] = useState<FormulaIngredient[]>(formula?.composition ?? [])
  const [isAddOpen, setAddOpen] = useState(false)
  const [showInci, setShowInci] = useState(false)

  // 처방 폼 데이터가 로드되면 composition 동기화
  if (formula && composition.length === 0 && formula.composition.length > 0) {
    setComposition(formula.composition)
  }

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormulaForm>({
    values: isNew ? undefined : {
      code: formula?.code ?? '',
      name: formula?.name ?? '',
      category: formula?.category ?? 'skincare',
      usageType: formula?.usageType ?? 'leave_on',
      formulaType: formula?.formulaType ?? 'manufacturing',
      linkedProductItemId: formula?.linkedProductItemId ?? '',
      description: formula?.description ?? '',
      manufacturingNotes: formula?.manufacturingNotes ?? '',
    },
  })

  const watchedProductId = watch('linkedProductItemId')
  const finishedItems = allItems.filter((i) => i.type === 'finished' || i.type === 'semi_finished')
  const productOptions = [{ value: '', label: '(미연결)' }, ...finishedItems.map((i) => ({ value: i.id, label: `[${i.code}] ${i.name}` }))]

  // 같은 완제품에 연결된 다른 처방 목록
  const relatedFormulas = watchedProductId
    ? allFormulas.filter((f) => f.linkedProductItemId === watchedProductId && f.id !== id)
    : []

  const { register: regAdd, handleSubmit: handleAdd, reset: resetAdd } = useForm<AddIngredientForm>()

  const totalPercentage = useMemo(
    () => Math.round(composition.reduce((sum, c) => sum + c.percentage, 0) * 1000) / 1000,
    [composition],
  )

  /** 성분 검증 */
  const verificationIssues = useMemo((): VerificationIssue[] => {
    const issues: VerificationIssue[] = []
    const usageType = formula?.usageType ?? 'leave_on'

    for (const comp of composition) {
      const ing = allIngredients.find((i) => i.id === comp.ingredientId)
      if (!ing) continue

      if (ing.isProhibited) {
        issues.push({
          type: 'prohibited',
          ingredientCode: ing.code,
          ingredientName: ing.nameKo,
          message: `금지 성분입니다`,
          severity: 'error',
        })
      }

      if (ing.maxUsagePercent != null && comp.percentage > ing.maxUsagePercent) {
        issues.push({
          type: 'limit_exceeded',
          ingredientCode: ing.code,
          ingredientName: ing.nameKo,
          message: `배합한도 ${ing.maxUsagePercent}% 초과 (현재 ${comp.percentage}%)`,
          severity: 'error',
        })
      }

      if (ing.isAllergen) {
        const threshold = usageType === 'leave_on' ? 0.001 : 0.01
        if (comp.percentage > threshold) {
          issues.push({
            type: 'allergen_labeling',
            ingredientCode: ing.code,
            ingredientName: ing.nameKo,
            message: `알러젠 표기 필요 (${usageType === 'leave_on' ? 'Leave-on' : 'Rinse-off'} 기준 ${threshold}% 초과)`,
            severity: 'warning',
          })
        }
      }
    }
    return issues
  }, [composition, allIngredients, formula?.usageType])

  /** 전성분표 (함량순 정렬) */
  const inciList = useMemo(() => {
    return [...composition]
      .sort((a, b) => b.percentage - a.percentage)
      .map((c) => c.inciName)
      .join(', ')
  }, [composition])

  const onAddIngredient = (data: AddIngredientForm) => {
    const ing = allIngredients.find((i) => i.id === data.ingredientId)
    if (!ing) return
    if (composition.some((c) => c.ingredientId === data.ingredientId)) {
      alert('이미 추가된 원료입니다.')
      return
    }
    setComposition((prev) => [...prev, {
      ingredientId: ing.id,
      ingredientCode: ing.code,
      nameKo: ing.nameKo,
      nameEn: ing.nameEn,
      inciName: ing.inciName,
      percentage: Number(data.percentage),
      purpose: data.purpose || undefined,
    }])
    resetAdd()
    setAddOpen(false)
  }

  const removeIngredient = (ingredientId: string) => {
    setComposition((prev) => prev.filter((c) => c.ingredientId !== ingredientId))
  }

  const onSave = async (data: FormulaForm) => {
    const linkedProduct = finishedItems.find((i) => i.id === data.linkedProductItemId)
    const payload = {
      code: data.code,
      name: data.name,
      category: data.category,
      usageType: data.usageType,
      formulaType: data.formulaType || 'manufacturing',
      linkedProductItemId: data.linkedProductItemId || null,
      linkedProductItemName: linkedProduct?.name ?? null,
      description: data.description || null,
      manufacturingNotes: data.manufacturingNotes || null,
      composition,
      totalPercentage,
      version: formula?.version ?? 1,
      status: (formula?.status ?? 'draft') as FormulaStatus,
    }
    if (isNew) {
      const docId = await createMutation.mutateAsync(payload)
      navigate(`/rnd/formulas/${docId}`, { replace: true })
    } else {
      await updateMutation.mutateAsync({ docId: id!, data: payload })
    }
  }

  const ingredientOptions = allIngredients.map((i) => ({
    value: i.id,
    label: `[${i.code}] ${i.nameKo} (${i.inciName})`,
  }))

  const compColumns = [
    { key: 'ingredientCode', label: '원료코드', width: '100px' },
    { key: 'nameKo', label: '원료명' },
    { key: 'inciName', label: 'INCI Name' },
    { key: 'percentage', label: '배합비(%)', width: '100px', render: (val: unknown) => `${val}%` },
    { key: 'purpose', label: '용도', render: (val: unknown) => val ? String(val) : '—' },
    {
      key: 'actions', label: '', width: '60px', sortable: false,
      render: (_: unknown, row: FormulaIngredient) => (
        <Button size="sm" variant="ghost" onClick={() => removeIngredient(row.ingredientId)}>삭제</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? '처방 작성' : `처방 상세 — ${formula?.name ?? ''}`}</h1>
        <Button variant="secondary" onClick={() => navigate('/rnd/formulas')}>목록</Button>
      </div>

      {/* 기본 정보 */}
      <Card title="기본 정보" className="mb-4">
        <form id="formulaForm" onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="처방코드 *" error={errors.code?.message} {...register('code', { required: '필수' })} />
            <Input label="처방명 *" error={errors.name?.message} {...register('name', { required: '필수' })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="제품유형" options={CATEGORY_OPTIONS} {...register('category')} />
            <Select label="사용유형" options={USAGE_TYPE_OPTIONS} {...register('usageType')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="처방유형 *" options={FORMULA_TYPE_OPTIONS} {...register('formulaType')} />
            <Select label="연결 완제품" options={productOptions} {...register('linkedProductItemId')} />
          </div>
          <Input label="설명" {...register('description')} />
          <Input label="제조 메모" {...register('manufacturingNotes')} />
        </form>
      </Card>

      {/* 성분 구성 */}
      <Card
        title="성분 구성"
        className="mb-4"
        actions={<Button size="sm" onClick={() => { resetAdd(); setAddOpen(true) }}>원료 추가</Button>}
      >
        <Table columns={compColumns} data={composition} keyField="ingredientId" emptyMessage="원료를 추가하세요." />
        <div className={`mt-3 text-sm font-semibold text-right ${totalPercentage === 100 ? 'text-green-600' : 'text-red-600'}`}>
          합계: {totalPercentage}% {totalPercentage !== 100 && '(100%가 되어야 합니다)'}
        </div>
      </Card>

      {/* 성분 검증 결과 */}
      {verificationIssues.length > 0 && (
        <Card title="성분 검증 결과" className="mb-4">
          <div className="space-y-2">
            {verificationIssues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                <Badge color={issue.severity === 'error' ? 'red' : 'yellow'}>
                  {issue.type === 'prohibited' ? '금지' : issue.type === 'limit_exceeded' ? '한도초과' : '알러젠'}
                </Badge>
                <span><strong>{issue.ingredientName}</strong> — {issue.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 전성분표 */}
      <Card
        title="전성분표 (INCI)"
        className="mb-4"
        actions={<Button size="sm" variant="ghost" onClick={() => setShowInci(!showInci)}>{showInci ? '접기' : '펼치기'}</Button>}
      >
        {showInci && (
          <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
            {inciList || '성분을 추가하면 전성분표가 자동 생성됩니다.'}
          </div>
        )}
        {!showInci && <p className="text-sm text-gray-500">펼치기를 눌러 전성분표를 확인하세요.</p>}
      </Card>

      {/* 같은 완제품의 다른 처방 */}
      {relatedFormulas.length > 0 && (
        <Card title="같은 완제품의 다른 처방" className="mb-4">
          <div className="space-y-2">
            {relatedFormulas.map((rf) => {
              const typeInfo: Record<string, { label: string; color: 'blue' | 'purple' | 'yellow' }> = {
                manufacturing: { label: '제조처방', color: 'blue' },
                label: { label: '표기처방', color: 'purple' },
                alternative: { label: '대체처방', color: 'yellow' },
              }
              const info = typeInfo[rf.formulaType] ?? { label: rf.formulaType, color: 'gray' as const }
              return (
                <div
                  key={rf.id}
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => navigate(`/rnd/formulas/${rf.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Badge color={info.color}>{info.label}</Badge>
                    <span className="text-sm font-medium text-gray-900">[{rf.code}] {rf.name}</span>
                    <span className="text-xs text-gray-500">v{rf.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{rf.composition?.length ?? 0}종</span>
                    <Badge color={rf.status === 'approved' ? 'green' : 'gray'}>
                      {rf.status === 'approved' ? '승인' : rf.status === 'review' ? '검토중' : '작성중'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 저장 */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/rnd/formulas')}>취소</Button>
        <Button type="submit" form="formulaForm" loading={createMutation.isPending || updateMutation.isPending}>
          {isNew ? '저장' : '수정 저장'}
        </Button>
      </div>

      {/* 원료 추가 모달 */}
      <Modal isOpen={isAddOpen} onClose={() => setAddOpen(false)} title="원료 추가">
        <form onSubmit={handleAdd(onAddIngredient)} className="space-y-4">
          <Select label="원료 *" options={ingredientOptions} placeholder="원료를 선택하세요" {...regAdd('ingredientId', { required: true })} />
          <Input label="배합비(%) *" type="number" step="0.001" {...regAdd('percentage', { required: true })} />
          <Input label="용도" {...regAdd('purpose')} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>취소</Button>
            <Button type="submit">추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
