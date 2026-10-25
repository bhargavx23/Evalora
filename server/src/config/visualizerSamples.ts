import { VisualizerSample } from '../models/VisualizerSample.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_VISUALIZER_SAMPLES = [
  {
    sampleId: 'js-array-accumulator',
    title: 'Array Accumulator & Loop',
    language: 'javascript',
    category: 'basics',
    difficulty: 'beginner',
    description: 'Iterates through an array and computes a running total while inspecting variables.',
    sortOrder: 1,
    code: `// Accumulate elements in an array
let numbers = [5, 12, 8, 130, 44];
let sum = 0;
let evensCount = 0;

for (let i = 0; i < numbers.length; i++) {
  let current = numbers[i];
  sum += current;
  if (current % 2 === 0) {
    evensCount++;
  }
}

console.log("Total sum:", sum);
console.log("Even numbers count:", evensCount);`
  },
  {
    sampleId: 'py-bubble-sort',
    title: 'Bubble Sort In-Place',
    language: 'python',
    category: 'sorting',
    difficulty: 'beginner',
    description: 'Watch elements compare and swap across iterations to sort an array.',
    sortOrder: 2,
    code: `# Step-by-step bubble sort algorithm
numbers = [64, 34, 25, 12, 22]
n = len(numbers)

for i in range(n):
    swapped = False
    for j in range(0, n - i - 1):
        if numbers[j] > numbers[j + 1]:
            temp = numbers[j]
            numbers[j] = numbers[j + 1]
            numbers[j + 1] = temp
            swapped = True
    if not swapped:
        break

print("Sorted array:", numbers)`
  },
  {
    sampleId: 'py-fibonacci-recursion',
    title: 'Fibonacci Call Stack',
    language: 'python',
    category: 'recursion',
    difficulty: 'intermediate',
    description: 'Inspect recursion call frames and return values on the call stack.',
    sortOrder: 3,
    code: `# Recursive Fibonacci with call stack tracking
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

result = fibonacci(4)
print("Fibonacci(4) =", result)`
  },
  {
    sampleId: 'js-binary-search',
    title: 'Binary Search Pointers',
    language: 'javascript',
    category: 'searching',
    difficulty: 'beginner',
    description: 'Tracks low, high, and mid pointers converging on a target in a sorted list.',
    sortOrder: 4,
    code: `// Binary search in a sorted array
const sortedArray = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
const target = 23;

let low = 0;
let high = sortedArray.length - 1;
let foundIndex = -1;

while (low <= high) {
  let mid = Math.floor((low + high) / 2);
  let midVal = sortedArray[mid];

  if (midVal === target) {
    foundIndex = mid;
    break;
  } else if (midVal < target) {
    low = mid + 1;
  } else {
    high = mid - 1;
  }
}

console.log("Target found at index:", foundIndex);`
  },
  {
    sampleId: 'js-frequency-counter',
    title: 'Frequency Counter Object',
    language: 'javascript',
    category: 'arrays',
    difficulty: 'beginner',
    description: 'Counts character frequencies and finds the most frequent item using a hash map.',
    sortOrder: 5,
    code: `// Frequency count using JavaScript object map
const words = ["apple", "banana", "apple", "orange", "banana", "apple"];
const frequency = {};

for (let i = 0; i < words.length; i++) {
  let word = words[i];
  if (!frequency[word]) {
    frequency[word] = 1;
  } else {
    frequency[word]++;
  }
}

console.log("Frequency Map:", frequency);`
  }
];

export async function seedDefaultVisualizerSamples(): Promise<void> {
  try {
    for (const sample of DEFAULT_VISUALIZER_SAMPLES) {
      await VisualizerSample.findOneAndUpdate(
        { sampleId: sample.sampleId },
        { $set: sample },
        { upsert: true, new: true }
      );
    }
    logger.info('VISUALIZER_SAMPLES_SEEDED', {
      details: { count: DEFAULT_VISUALIZER_SAMPLES.length }
    });
  } catch (err: any) {
    logger.error('VISUALIZER_SAMPLES_SEED_ERROR', {
      details: { message: err.message }
    });
  }
}
