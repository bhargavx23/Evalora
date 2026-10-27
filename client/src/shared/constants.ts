export const TOPICS = [
  'Arrays',
  'Strings',
  'Linked Lists',
  'Trees',
  'Graphs',
  'Recursion',
  'Dynamic Programming',
  'Quantitative Aptitude',
  'Logical Reasoning',
  'Verbal Ability',
  'DBMS',
  'Operating Systems',
  'Computer Networks',
  'OOP'
] as const;

export const TOPIC_CATEGORIES: Record<string, string[]> = {
  'Data Structures & Algorithms': [
    'Arrays',
    'Strings',
    'Linked Lists',
    'Trees',
    'Graphs',
    'Recursion',
    'Dynamic Programming'
  ],
  'Aptitude': [
    'Quantitative Aptitude',
    'Logical Reasoning',
    'Verbal Ability'
  ],
  'Core Computer Science': [
    'DBMS',
    'Operating Systems',
    'Computer Networks',
    'OOP'
  ]
};

export const DEFAULT_STARTER_CODES = {
  c: `#include <stdio.h>

int main() {
    // Read input from standard input
    // Print output to standard output
    return 0;
}
`,
  cpp: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // Read input from cin
    // Print output to cout
    return 0;
}
`,
  python: `import sys

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Process inputs and print results
    pass

if __name__ == '__main__':
    main()
`,
  java: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read input from scanner
        // Print output using System.out.println
    }
}
`,
  javascript: `const fs = require('fs');

function main() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    // Process input
}

main();
`,
  nodejs: `const fs = require('fs');

function main() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    // Process input
}

main();
`,
  sql: `-- Write your SQL query below
SELECT *
FROM employees
LIMIT 10;
`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Document</title>
</head>
<body>
  <h1>Hello, World!</h1>
</body>
</html>
`,
  css: `/* Add your CSS styles below */
body {
  font-family: sans-serif;
  padding: 20px;
}
`
};

export const PASTEL_THEME = {
  background: '#FAFAF8',
  primaryPastel: '#DDE7F7',
  secondaryPastel: '#E8E1F4',
  accentPastel: '#DCEFE8',
  warmAccent: '#F5E5D3',
  softWarning: '#F7E6B5',
  softDanger: '#F4D8D8',
  text: '#49465B',
  secondaryText: '#6B7280',
  borders: '#E5E7EB'
} as const;
