import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Button, Card } from '@/components/ui'
import { ITEM_TYPE_LABEL } from '@/types/master'
import type { ItemType } from '@/types'

/** 품목구분별 기본 설정 */
interface ItemTypeConfig {
  requiresLotTracking: boolean
  defaultUnit: string
  defaultProcurement: string
  /** 유효기한 관리 여부 */
  requiresExpiryDate: boolean
  /** 바코드 필수 여부 */
  requiresBarcode: boolean
  /** 안전재고 기본값 */
  defaultSafetyStock: number
}

type ItemTypeSettings = Record<ItemType, ItemTypeConfig>

const UNIT_OPTIONS = ['kg', 'g', 'L', 'mL', 'ea', 'box', 'set', 'pack']
const PROCUREMENT_OPTIONS = [
  { value: 'production', label: '생산' },
  { value: 'purchase', label: '구매' },
  { value: 'supplied', label: '사급' },
  { value: 'development', label: '개발' },
]

const DEFAULT_CONFIG: ItemTypeConfig = {
  requiresLotTracking: true,
  defaultUnit: 'kg',
  defaultProcurement: 'purchase',
  requiresExpiryDate: false,
  requiresBarcode: false,
  defaultSafetyStock: 0,
}

const ITEM_TYPES = Object.keys(ITEM_TYPE_LABEL) as ItemType[]

export default function ItemTypeSettingsPage() {
  const [settings, setSettings] = useState<ItemTypeSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Firestore에서 설정 로드
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'systemSettings', 'itemTypeDefaults'))
        if (snap.exists()) {
          const data = snap.data() as Partial<ItemTypeSettings>
          const merged: Record<string, ItemTypeConfig> = {}
          for (const type of ITEM_TYPES) {
            merged[type] = { ...DEFAULT_CONFIG, ...(data[type] ?? {}) }
          }
          setSettings(merged as ItemTypeSettings)
        } else {
          // 기본값 생성
          const defaults: Record<string, ItemTypeConfig> = {}
          for (const type of ITEM_TYPES) {
            defaults[type] = { ...DEFAULT_CONFIG }
            // 원자재/부자재는 LOT 기본 활성
            if (type === 'raw_material' || type === 'sub_material') {
              defaults[type].requiresLotTracking = true
              defaults[type].requiresExpiryDate = true
            }
            // 제품은 생산
            if (type === 'finished' || type === 'bulk') {
              defaults[type].defaultProcurement = 'production'
              defaults[type].defaultUnit = 'ea'
            }
          }
          setSettings(defaults as ItemTypeSettings)
        }
      } catch (err) {
        console.error('설정 로드 실패:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const updateSetting = (type: ItemType, key: keyof ItemTypeConfig, value: unknown) => {
    if (!settings) return
    setSettings((prev) => prev ? { ...prev, [type]: { ...prev[type], [key]: value } } : prev)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'systemSettings', 'itemTypeDefaults'), settings)
      setHasChanges(false)
      alert('설정이 저장되었습니다.')
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12 text-gray-500">로딩 중...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">품목구분별 기본 설정</h1>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-orange-600 font-medium">변경사항 있음</span>
            <Button onClick={handleSave} loading={saving}>설정 저장</Button>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-6">
        품목구분별로 기본값을 설정하면 품목 추가 시 자동으로 적용됩니다.
      </p>

      <div className="overflow-auto">
        <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">품목구분</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 w-20">LOT관리</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 w-20">유효기한</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 w-20">바코드필수</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">기본단위</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">기본조달</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-28">안전재고 기본값</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ITEM_TYPES.map((type) => {
              const config = settings?.[type] ?? DEFAULT_CONFIG
              return (
                <tr key={type} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ITEM_TYPE_LABEL[type]}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={config.requiresLotTracking}
                      onChange={(e) => updateSetting(type, 'requiresLotTracking', e.target.checked)}
                      className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={config.requiresExpiryDate}
                      onChange={(e) => updateSetting(type, 'requiresExpiryDate', e.target.checked)}
                      className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={config.requiresBarcode}
                      onChange={(e) => updateSetting(type, 'requiresBarcode', e.target.checked)}
                      className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={config.defaultUnit}
                      onChange={(e) => updateSetting(type, 'defaultUnit', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={config.defaultProcurement}
                      onChange={(e) => updateSetting(type, 'defaultProcurement', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      {PROCUREMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={config.defaultSafetyStock}
                      onChange={(e) => updateSetting(type, 'defaultSafetyStock', Number(e.target.value))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Card className="mt-6">
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>LOT관리:</strong> 체크하면 해당 구분의 품목은 입출고 시 LOT번호 필수</p>
          <p><strong>유효기한:</strong> 체크하면 입고 시 유효기한 입력 필수</p>
          <p><strong>바코드필수:</strong> 체크하면 품목 등록 시 바코드 필수 입력</p>
          <p><strong>기본단위/조달:</strong> 품목 추가 시 자동으로 설정되는 기본값</p>
          <p><strong>안전재고 기본값:</strong> 품목 추가 시 자동으로 설정되는 안전재고 수량</p>
        </div>
      </Card>
    </div>
  )
}
