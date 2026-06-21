import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { PracticePlan, PracticePlanItem } from '@/types'

const plans = ref<PracticePlan[]>([])
const items = ref<PracticePlanItem[]>([])
const error = ref<string | null>(null)

export function usePracticePlan() {
  async function fetchPlans() {
    if (!isSupabaseConfigured) { error.value = 'Supabase not configured — see README.'; return }
    const { data, error: err } = await supabase
      .from('practice_plans')
      .select('*')
      .order('planned_for', { ascending: false, nullsFirst: false })
    if (err) error.value = err.message
    else plans.value = (data ?? []) as PracticePlan[]
  }

  async function fetchPlanItems(planId: string) {
    if (!isSupabaseConfigured) return
    const { data, error: err } = await supabase
      .from('practice_plan_items')
      .select('*, play:plays(name, diagram)')
      .eq('plan_id', planId)
      .order('sort_order', { ascending: true })
    if (err) error.value = err.message
    else items.value = (data ?? []) as PracticePlanItem[]
  }

  async function createPlan(p: Omit<PracticePlan, 'id' | 'created_at'>): Promise<PracticePlan | null> {
    const { data, error: err } = await supabase.from('practice_plans').insert(p).select().single()
    if (err) { error.value = err.message; return null }
    plans.value = [data as PracticePlan, ...plans.value]
    return data as PracticePlan
  }

  async function deletePlan(id: string): Promise<boolean> {
    const { error: err } = await supabase.from('practice_plans').delete().eq('id', id)
    if (err) { error.value = err.message; return false }
    plans.value = plans.value.filter((p) => p.id !== id)
    return true
  }

  async function addItem(item: Omit<PracticePlanItem, 'id' | 'created_at' | 'play'>): Promise<PracticePlanItem | null> {
    const { data, error: err } = await supabase
      .from('practice_plan_items')
      .insert(item)
      .select('*, play:plays(name, diagram)')
      .single()
    if (err) { error.value = err.message; return null }
    items.value = [...items.value, data as PracticePlanItem]
    return data as PracticePlanItem
  }

  async function updateItem(id: string, patch: Partial<Pick<PracticePlanItem, 'duration_min' | 'notes' | 'sort_order' | 'label'>>): Promise<boolean> {
    const { error: err } = await supabase.from('practice_plan_items').update(patch).eq('id', id)
    if (err) { error.value = err.message; return false }
    items.value = items.value.map((i) => (i.id === id ? { ...i, ...patch } : i))
    return true
  }

  async function deleteItem(id: string): Promise<boolean> {
    const { error: err } = await supabase.from('practice_plan_items').delete().eq('id', id)
    if (err) { error.value = err.message; return false }
    items.value = items.value.filter((i) => i.id !== id)
    return true
  }

  async function reorderItems(orderedIds: string[]): Promise<void> {
    items.value = orderedIds
      .map((id, idx) => {
        const item = items.value.find((i) => i.id === id)!
        return { ...item, sort_order: idx }
      })
      .filter(Boolean)
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('practice_plan_items').update({ sort_order: idx }).eq('id', id),
      ),
    )
  }

  return {
    plans, items, error,
    fetchPlans, fetchPlanItems,
    createPlan, deletePlan,
    addItem, updateItem, deleteItem, reorderItems,
  }
}
