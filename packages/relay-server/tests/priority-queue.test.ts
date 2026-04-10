import { describe, expect, it } from 'vitest'
import { PriorityQueue } from '../src/priority-queue.js'

describe('PriorityQueue', () => {
  it('should maintain min-heap property', () => {
    const pq = new PriorityQueue<string>()
    pq.push('task1', 100)
    pq.push('task2', 50)
    pq.push('task3', 150)
    pq.push('task4', 20)

    expect(pq.size()).toBe(4)
    expect(pq.peek()?.value).toBe('task4')

    expect(pq.pop()).toBe('task4')
    expect(pq.pop()).toBe('task2')
    expect(pq.pop()).toBe('task1')
    expect(pq.pop()).toBe('task3')
    expect(pq.pop()).toBeUndefined()
    expect(pq.size()).toBe(0)
  })

  it('should peek without removing', () => {
    const pq = new PriorityQueue<string>()
    pq.push('a', 10)
    expect(pq.peek()?.value).toBe('a')
    expect(pq.size()).toBe(1)
    expect(pq.peek()?.value).toBe('a')
  })

  it('should clear all elements', () => {
    const pq = new PriorityQueue<string>()
    pq.push('a', 1)
    pq.push('b', 2)
    pq.clear()
    expect(pq.size()).toBe(0)
    expect(pq.peek()).toBeUndefined()
  })

  it('should handle elements with same priority', () => {
    const pq = new PriorityQueue<string>()
    pq.push('a', 10)
    pq.push('b', 10)
    const first = pq.pop()
    const second = pq.pop()
    expect([first, second]).toContain('a')
    expect([first, second]).toContain('b')
  })
})
