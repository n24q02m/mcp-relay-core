export interface PriorityQueueNode<T> {
  value: T
  priority: number
}

export class PriorityQueue<T> {
  private heap: PriorityQueueNode<T>[] = []

  push(value: T, priority: number): void {
    this.heap.push({ value, priority })
    this.bubbleUp()
  }

  pop(): T | undefined {
    if (this.size() === 0) return undefined
    const top = this.heap[0].value
    const last = this.heap.pop()
    if (this.size() > 0 && last !== undefined) {
      this.heap[0] = last
      this.sinkDown()
    }
    return top
  }

  peek(): PriorityQueueNode<T> | undefined {
    return this.heap[0]
  }

  size(): number {
    return this.heap.length
  }

  clear(): void {
    this.heap = []
  }

  private bubbleUp(): void {
    let index = this.heap.length - 1
    const element = this.heap[index]
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      const parent = this.heap[parentIndex]
      if (element.priority >= parent.priority) break
      this.heap[index] = parent
      index = parentIndex
    }
    this.heap[index] = element
  }

  private sinkDown(): void {
    let index = 0
    const length = this.heap.length
    const element = this.heap[0]
    while (true) {
      const leftChildIndex = 2 * index + 1
      const rightChildIndex = 2 * index + 2
      let leftChild: PriorityQueueNode<T> | undefined
      let rightChild: PriorityQueueNode<T> | undefined
      let swap = null

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex]
        if (leftChild.priority < element.priority) {
          swap = leftChildIndex
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex]
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && leftChild !== undefined && rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIndex
        }
      }

      if (swap === null) break
      this.heap[index] = this.heap[swap]
      index = swap
    }
    this.heap[index] = element
  }
}
