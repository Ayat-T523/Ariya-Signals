import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver } from 'driver.js'
import type { Driver } from 'driver.js'
import { useApp } from '../context/AppContext'

interface TourStep {
  route: string
  element: string
  popover: {
    title: string
    description: string
    side: 'top' | 'bottom' | 'left' | 'right'
    align: 'start' | 'center' | 'end'
  }
}

const STEPS: TourStep[] = [
  {
    route: '/',
    element: '[data-tour="kpi-row"]',
    popover: {
      title: 'Your command centre',
      description: 'Track competitor activity and signal volume at a glance across your whole landscape.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    route: '/',
    element: '[data-tour="top-signals"]',
    popover: {
      title: 'Signals to triage',
      description: 'Ariya prioritises what needs your attention. Click any signal for full context and recommended action.',
      side: 'right',
      align: 'start',
    },
  },
  {
    route: '/',
    element: '[data-tour="market-weather"]',
    popover: {
      title: 'Market weather',
      description: "A weekly synthesis of what's moving in your market — and what it means for sebetralstat.",
      side: 'left',
      align: 'start',
    },
  },
  {
    route: '/competitors',
    element: '[data-tour="competitors-page"]',
    popover: {
      title: 'Competitor tracker',
      description: 'Every active competitor in your space. Filter by asset class, pipeline stage, or watch status.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    route: '/competitors/pharvaris',
    element: '[data-tour="competitor-profile"]',
    popover: {
      title: 'Competitor profile',
      description: 'Deep dive into any competitor — pipeline timelines, recent signals, messaging themes, and clinical trial status.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    route: '/intelligence',
    element: '[data-tour="intelligence-feed"]',
    popover: {
      title: 'Intelligence Feed',
      description: 'Upcoming events and congresses, published reports, and market developments — all in one feed.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    route: '/alerts',
    element: '[data-tour="alerts-page"]',
    popover: {
      title: 'Alerts',
      description: 'Configurable alerts with "why it matters" context, so nothing important slips past your team.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    route: '/myspace',
    element: '[data-tour="myspace-page"]',
    popover: {
      title: 'My Space',
      description: 'Your personal hub — configure alert thresholds and store private reference documents.',
      side: 'bottom',
      align: 'start',
    },
  },
]

export function useTour() {
  const { tourActive, endTour } = useApp()
  const navigate = useNavigate()
  const driverRef = useRef<Driver | null>(null)
  const endedRef = useRef(false)

  useEffect(() => {
    if (!tourActive) return

    endedRef.current = false

    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        allowClose: true,
        smoothScroll: true,
        popoverClass: 'ariya-tour-popover',
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        doneBtnText: 'Start exploring',
        steps: STEPS.map(({ element, popover }) => ({ element, popover })),
        onNextClick(_el, _step, opts) {
          const currentIndex = opts.state.activeIndex ?? 0
          const nextIndex = currentIndex + 1

          if (nextIndex >= STEPS.length) {
            if (!endedRef.current) {
              endedRef.current = true
              endTour(true, currentIndex)
            }
            driverRef.current?.destroy()
            return
          }

          const currentRoute = STEPS[currentIndex].route
          const nextRoute = STEPS[nextIndex].route

          if (currentRoute !== nextRoute) {
            navigate(nextRoute)
            setTimeout(() => driverRef.current?.moveNext(), 500)
          } else {
            driverRef.current?.moveNext()
          }
        },
        onPrevClick(_el, _step, opts) {
          const currentIndex = opts.state.activeIndex ?? 0
          const prevIndex = currentIndex - 1
          if (prevIndex < 0) return

          const currentRoute = STEPS[currentIndex].route
          const prevRoute = STEPS[prevIndex].route

          if (currentRoute !== prevRoute) {
            navigate(prevRoute)
            setTimeout(() => driverRef.current?.movePrevious(), 500)
          } else {
            driverRef.current?.movePrevious()
          }
        },
        onDestroyStarted(_el, _step, opts) {
          if (!endedRef.current) {
            endedRef.current = true
            const activeIndex = opts.state.activeIndex ?? 0
            const isComplete = activeIndex === STEPS.length - 1
            endTour(isComplete, activeIndex)
          }
        },
      })
      driverRef.current = driverObj
      driverObj.drive()
    }, 350)

    return () => {
      clearTimeout(timer)
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [tourActive])
}
