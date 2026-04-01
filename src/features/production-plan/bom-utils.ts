/**
 * BOM 처리 유틸리티
 * 기존 프로그램의 BOM 전개(explode) 로직을 그대로 이식
 * - 4번 코드(반제품/충진품): 재귀적으로 풀어서 세부 자재 반환
 * - 5번 코드(벌크) + 생산 타입: bulks로 분류
 * - 나머지 구매/사급: materials(부자재)로 분류
 */

import type { PlanBomRow, ResolvedBom } from '@/types/production-plan'

/** product_code별 BOM 인덱스 생성 */
export function buildBomIndex(allBom: PlanBomRow[]): Record<string, PlanBomRow[]> {
  const idx: Record<string, PlanBomRow[]> = {}
  allBom.forEach(r => {
    if (!idx[r.productCode]) idx[r.productCode] = []
    idx[r.productCode].push(r)
  })
  return idx
}

/** 4번 코드(반제품)를 재귀적으로 풀어서 세부 자재 반환 */
function explodeBom(
  mats: PlanBomRow[],
  allBom: PlanBomRow[],
  bomIndex: Record<string, PlanBomRow[]>,
): PlanBomRow[] {
  const result: PlanBomRow[] = []
  mats.forEach(m => {
    if (String(m.matCode).startsWith('4')) {
      const children = bomIndex[m.matCode] || []
      if (!children.length) {
        result.push(m)
        return
      }
      children.forEach(sub => {
        const item: PlanBomRow = {
          productCode: m.productCode,
          productName: m.productName,
          matCode: sub.matCode,
          matName: sub.matName,
          matQty: sub.matQty,
          matType: sub.matType,
        }
        if (String(sub.matCode).startsWith('4')) {
          result.push(...explodeBom([item], allBom, bomIndex))
        } else {
          result.push(item)
        }
      })
    } else {
      result.push(m)
    }
  })
  return result
}

/** 완제품 코드 기준으로 BOM을 완전히 풀어서 {bulks, materials} 반환 */
export function resolveProductMaterials(
  productCode: string,
  _productName: string,
  allBom: PlanBomRow[],
  bomIndex?: Record<string, PlanBomRow[]>,
): ResolvedBom {
  const idx = bomIndex || buildBomIndex(allBom)
  const direct = idx[productCode] || []
  const allResolved = explodeBom(direct, allBom, idx)

  const bulks: PlanBomRow[] = []
  const materials: PlanBomRow[] = []

  allResolved.forEach(m => {
    if (String(m.matCode).startsWith('5') && m.matType === '생산') {
      bulks.push(m)
    } else if (m.matType !== '생산') {
      materials.push(m)
    }
  })

  return { bulks, materials }
}

/** 관련 제품 조회 (같은 벌크를 공유하는 다른 완제품) */
export function getRelatedProducts(
  code: string,
  allBom: PlanBomRow[],
  bomIndex?: Record<string, PlanBomRow[]>,
): { productCode: string; productName: string; sharedBulks: { code: string; name: string }[] }[] {
  const idx = bomIndex || buildBomIndex(allBom)
  const resolved = resolveProductMaterials(code, '', allBom, idx)
  const myBulkSet = new Set(resolved.bulks.map(b => b.matCode))
  if (!myBulkSet.size) return []

  const allProducts = new Set(
    allBom.filter(r => String(r.productCode).startsWith('1')).map(r => r.productCode),
  )

  const related: { productCode: string; productName: string; sharedBulks: { code: string; name: string }[] }[] = []
  allProducts.forEach(pc => {
    if (pc === code) return
    const otherResolved = resolveProductMaterials(pc, '', allBom, idx)
    const sharedBulks = otherResolved.bulks.filter(b => myBulkSet.has(b.matCode))
    if (sharedBulks.length) {
      const pRow = allBom.find(r => r.productCode === pc)
      related.push({
        productCode: pc,
        productName: pRow?.productName ?? '',
        sharedBulks: sharedBulks.map(b => ({ code: b.matCode, name: b.matName })),
      })
    }
  })
  return related
}
