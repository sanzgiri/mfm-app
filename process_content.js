import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const doc1 = fs.readFileSync('doc1.txt', 'utf8');
const doc2 = fs.readFileSync('doc2.txt', 'utf8');

function parseDoc(text) {
    const pages = text.split('PAGE BREAK').map(p => p.trim()).filter(p => p);
    const data = {
        introduction: '',
        howToUse: '',
        weeks: [],
        conclusion: '',
        references: '',
        about: ''
    };

    pages.forEach(page => {
        const lines = page.split('\n').map(l => l.trim()).filter(l => l);
        const firstLine = lines[0] || '';

        // 0. Skip Table of Contents
        if (page.includes('Table of Contents')) {
            return;
        }

        // 1. Static Sections
        if (firstLine.includes('Introduction: Welcome to Imperfection')) {
            data.introduction = page;
            return;
        }
        if (firstLine.includes('How to Use This Workbook')) {
            data.howToUse = page;
            return;
        }
        if (firstLine.includes('Conclusion:')) {
            data.conclusion = page;
            return;
        }
        if (firstLine.includes('References')) {
            data.references = page;
            return;
        }
        if (firstLine.includes('About This Workbook')) {
            data.about = page;
            return;
        }

        // 2. Week / Day Logic
        const weekMatch = firstLine.match(/^WEEK (\d+):/i);
        const dayMatch = page.match(/Day (\d+):/); // Day might not be first line if Week header exists

        if (weekMatch) {
            const weekNum = parseInt(weekMatch[1]);
            ensureWeek(data, weekNum);

            // It's a Week Intro page
            data.weeks[weekNum - 1].title = firstLine; // e.g. "WEEK 1: EMBRACING REALITY"
            data.weeks[weekNum - 1].intro = page;

            // Does it ALSO contain a Day? (Day 1 often shares page with Week 1 Intro)
            if (dayMatch) {
                const dayNum = parseInt(dayMatch[1]);
                const dayObj = parseDay(page, dayNum);
                addDayToWeek(data, weekNum, dayObj);
            }
        } else if (dayMatch) {
            // It's a isolated Day page (Day 2, 3, etc)
            const dayNum = parseInt(dayMatch[1]);
            const weekNum = Math.ceil(dayNum / 7);
            ensureWeek(data, weekNum);

            const dayObj = parseDay(page, dayNum);
            addDayToWeek(data, weekNum, dayObj);
        }
    });

    return data;
}

function ensureWeek(data, weekNum) {
    if (!data.weeks[weekNum - 1]) {
        data.weeks[weekNum - 1] = {
            number: weekNum,
            title: `Week ${weekNum}`,
            intro: '',
            days: []
        };
    }
}

function addDayToWeek(data, weekNum, dayObj) {
    // Check if day already exists to avoid duplicates
    const existing = data.weeks[weekNum - 1].days.find(d => d.day === dayObj.day);
    if (!existing) {
        data.weeks[weekNum - 1].days.push(dayObj);
    }
}

function parseDay(page, dayNum) {
    const lines = page.split('\n').map(l => l.trim()).filter(l => l);

    // Improved Title Regex: Day X: [Title]
    const titleRegex = new RegExp(`^Day ${dayNum}:?\\s*(.*)`, 'i');
    let title = `Day ${dayNum}`;
    let titleLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(titleRegex);
        if (match) {
            title = match[1] || `Day ${dayNum}`; // Capture group 1 is the title text
            titleLineIndex = i;
            break;
        }
    }

    // Cleaning fullText:
    // Drop lines before the title line (e.g. Week Intro)
    // Drop the title line itself
    let contentLines = [];
    if (titleLineIndex !== -1) {
        contentLines = lines.slice(titleLineIndex + 1);
    } else {
        contentLines = lines;
    }

    // Filter out separator lines or unwanted headers from the remaining content
    const cleanedLines = contentLines.filter(line => {
        if (line.match(/^WEEK \d+:/i)) return false;
        if (line.includes('____')) return false;
        return true;
    });

    // Extract "Example" section specifically for merging
    const rwMatch = page.match(/(Real-World Example|Netflix Example|Movie Example):/);

    let exampleSection = '';
    if (rwMatch) {
        const start = page.indexOf(rwMatch[0]);
        let end = page.indexOf('Reflection Questions:');
        if (end === -1) end = page.indexOf('Notes Space:');

        if (end > start) {
            exampleSection = page.substring(start, end).trim();
        }
    }

    return {
        day: dayNum,
        title: title,
        subtitle: '', // Still empty as subtitle structure varies
        fullText: cleanedLines.join('\n\n'), // Join with double newline for paragraphs
        example: exampleSection
    };
}

const data1 = parseDoc(doc1);
const data2 = parseDoc(doc2);

// Merge: Add Movie Examples from data2 to data1
data1.weeks.forEach((week, wIndex) => {
    if (!week) return; // week might be sparse if parsing failed for some
    const week2 = data2.weeks[wIndex];
    if (!week2) return;

    week.days.forEach((day) => {
        // Find corresponding day in doc2
        const day2 = week2.days.find(d => d.day === day.day);

        if (day2 && day2.example) {
            // Check if we need to merge
            // Merging logic: Append day2.example AFTER day.example (Real-World)
            // Logic: Find insertion point

            // If day1 has "Reflection Questions:", insert before it.
            const insertionMarker = 'Reflection Questions:';
            const idx = day.fullText.indexOf(insertionMarker);

            if (idx !== -1) {
                // Check if day2 example is already in day1 (idempotency)
                if (!day.fullText.includes(day2.example.substring(0, 20))) {
                    const before = day.fullText.slice(0, idx);
                    const after = day.fullText.slice(idx);
                    // Add spacing
                    day.fullText = before.trim() + "\n\n" + day2.example + "\n\n" + after;
                }
            } else {
                // Determine other append strategy
                if (!day.fullText.includes(day2.example.substring(0, 20))) {
                    day.fullText += "\n\n" + day2.example;
                }
            }
        }
    });
});

console.log('export const meditationData = ' + JSON.stringify(data1, null, 2) + ';');
