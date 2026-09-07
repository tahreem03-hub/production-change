const BASE = import.meta.env.VITE_API_URL

/**
 * GET /schedule
 * Returns the full schedule document including production, rules, cast,
 * locations, scenes, days, baseline_cost, and violations.
 */
export async function getSchedule() {
  const res = await fetch(`${BASE}/schedule`)
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(detail.detail ?? res.statusText), {
      status: res.status,
      detail: detail.detail ?? res.statusText,
    })
  }
  return res.json()
}

/**
 * POST /change
 * @param {string} request  – natural-language change request
 * @returns {Promise<object>} – { status, plans?, rejected?, parallel_results? }
 */
export async function postChange(request) {
  const res = await fetch(`${BASE}/change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, use_search: true }),
  })

  // 422 – bad phrasing; 404 – unknown scene/day
  if (res.status === 422 || res.status === 404) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(body.detail ?? res.statusText), {
      status: res.status,
      detail: body.detail ?? res.statusText,
    })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(body.detail ?? res.statusText), {
      status: res.status,
      detail: body.detail ?? res.statusText,
    })
  }

  return res.json()
}
