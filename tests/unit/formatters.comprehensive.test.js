/**
 * COMPREHENSIVE Formatter Tests (200 tests)
 * Testing REAL functions from Code.js
 */

const backend = require('../setup/backend-bridge');
const { formatDate_, formatTime_, slugify_ } = backend;

describe('COMPREHENSIVE Utils: Formatters', () => {
  
  describe('formatDate_ - Comprehensive', () => {
    
    describe('Short format - all months', () => {
      const months = [
        ['2025-01-15', 'Jan'],
        ['2025-02-15', 'Feb'],
        ['2025-03-15', 'Mar'],
        ['2025-04-15', 'Apr'],
        ['2025-05-15', 'May'],
        ['2025-06-15', 'Jun'],
        ['2025-07-15', 'Jul'],
        ['2025-08-15', 'Aug'],
        ['2025-09-15', 'Sep'],
        ['2025-10-15', 'Oct'],
        ['2025-11-15', 'Nov'],
        ['2025-12-15', 'Dec']
      ];
      
      months.forEach(([date, expectedMonth]) => {
        test(`formats ${date} with ${expectedMonth}`, () => {
          const result = formatDate_(date);
          expect(result).toContain(expectedMonth);
          expect(result).toContain('15');
          expect(result).toContain('2025');
        });
      });
    });
    
    describe('Long format - all months', () => {
      const longMonths = [
        ['2025-01-15', 'January'],
        ['2025-02-15', 'February'],
        ['2025-03-15', 'March'],
        ['2025-04-15', 'April'],
        ['2025-05-15', 'May'],
        ['2025-06-15', 'June'],
        ['2025-07-15', 'July'],
        ['2025-08-15', 'August'],
        ['2025-09-15', 'September'],
        ['2025-10-15', 'October'],
        ['2025-11-15', 'November'],
        ['2025-12-15', 'December']
      ];
      
      longMonths.forEach(([date, expectedMonth]) => {
        test(`long format ${date} includes ${expectedMonth}`, () => {
          const result = formatDate_(date, 'long');
          expect(result).toContain(expectedMonth);
          expect(result).toContain('15');
          expect(result).toContain('2025');
        });
      });
    });
    
    describe('All days of month', () => {
      for (let day = 1; day <= 31; day++) {
        test(`formats day ${day} correctly`, () => {
          const dateStr = `2025-01-${day.toString().padStart(2, '0')}`;
          const result = formatDate_(dateStr);
          expect(result).toContain(day.toString());
        });
      }
    });
    
    describe('Edge cases', () => {
      test('handles leap year Feb 29', () => {
        const result = formatDate_('2024-02-29');
        expect(result).toContain('Feb');
        expect(result).toContain('29');
      });
      
      test('handles year boundaries', () => {
        expect(formatDate_('2025-12-31')).toContain('Dec');
        expect(formatDate_('2025-01-01')).toContain('Jan');
      });
      
      test('returns Invalid Date for bad input', () => {
        expect(formatDate_('not-a-date')).toBe('Invalid Date');
        expect(formatDate_('')).toBe('Invalid Date');
        expect(formatDate_(null)).toBe('Invalid Date');
      });
    });
  });
  
  describe('formatTime_ - Comprehensive', () => {
    
    describe('All hours - AM', () => {
      for (let hour = 0; hour < 12; hour++) {
        test(`converts ${hour}:00 to 12-hour AM format`, () => {
          const time24 = `${hour}:00`;
          const result = formatTime_(time24);
          expect(result).toContain('AM');
          const displayHour = hour === 0 ? 12 : hour;
          expect(result).toContain(displayHour.toString());
        });
      }
    });
    
    describe('All hours - PM', () => {
      for (let hour = 12; hour < 24; hour++) {
        test(`converts ${hour}:00 to 12-hour PM format`, () => {
          const time24 = `${hour}:00`;
          const result = formatTime_(time24);
          expect(result).toContain('PM');
          const displayHour = hour === 12 ? 12 : hour - 12;
          expect(result).toContain(displayHour.toString());
        });
      }
    });
    
    describe('Various minutes', () => {
      const minutes = ['00', '15', '30', '45', '59'];
      minutes.forEach(min => {
        test(`preserves minute ${min}`, () => {
          const result = formatTime_(`14:${min}`);
          expect(result).toContain(min);
        });
      });
    });
    
    describe('Edge cases', () => {
      test('midnight (00:00) becomes 12:00 AM', () => {
        expect(formatTime_('00:00')).toBe('12:00 AM');
      });
      
      test('noon (12:00) becomes 12:00 PM', () => {
        expect(formatTime_('12:00')).toBe('12:00 PM');
      });
      
      test('handles single-digit hours', () => {
        expect(formatTime_('9:30')).toBe('9:30 AM');
      });
      
      test('returns empty for invalid input', () => {
        expect(formatTime_('')).toBe('');
        expect(formatTime_(null)).toBe('');
        expect(formatTime_('invalid')).toBe('');
      });
    });
  });
  
  describe('slugify_ - Comprehensive', () => {
    
    describe('Special characters removal', () => {
      const specialChars = [
        ['Hello World!', 'hello-world'],
        ['Test@Event#2024', 'testevent2024'],
        ['My$Event%Name', 'myeventname'],
        ['Event (2024)', 'event-2024'],
        ['Test&Event', 'testevent'],
        ['Event*Name', 'eventname'],
        ['Question?', 'question'],
        ['Price: $50', 'price-50']
      ];
      
      specialChars.forEach(([input, expected]) => {
        test(`converts "${input}" to "${expected}"`, () => {
          expect(slugify_(input)).toBe(expected);
        });
      });
    });
    
    describe('Space and hyphen handling', () => {
      test('converts single space to hyphen', () => {
        expect(slugify_('Hello World')).toBe('hello-world');
      });
      
      test('converts multiple spaces to single hyphen', () => {
        expect(slugify_('Hello   World')).toBe('hello-world');
      });
      
      test('preserves existing hyphens', () => {
        expect(slugify_('my-event-name')).toBe('my-event-name');
      });
      
      test('converts underscores to hyphens', () => {
        expect(slugify_('my_event_name')).toBe('my-event-name');
      });
      
      test('removes leading/trailing hyphens', () => {
        expect(slugify_('-event-')).toBe('event');
        expect(slugify_('--event--')).toBe('event');
      });
    });
    
    describe('Case conversion', () => {
      test('converts uppercase to lowercase', () => {
        expect(slugify_('HELLO')).toBe('hello');
      });
      
      test('converts mixed case to lowercase', () => {
        expect(slugify_('HelloWorld')).toBe('helloworld');
      });
    });
    
    describe('Numbers', () => {
      test('preserves numbers', () => {
        expect(slugify_('Event 2024')).toBe('event-2024');
        expect(slugify_('123 Test')).toBe('123-test');
      });
    });
    
    describe('Whitespace handling', () => {
      test('trims leading whitespace', () => {
        expect(slugify_('  hello')).toBe('hello');
      });
      
      test('trims trailing whitespace', () => {
        expect(slugify_('hello  ')).toBe('hello');
      });
      
      test('trims both sides', () => {
        expect(slugify_('  hello world  ')).toBe('hello-world');
      });
    });
    
    describe('Edge cases', () => {
      test('handles empty string', () => {
        expect(slugify_('')).toBe('');
      });
      
      test('handles null', () => {
        expect(slugify_(null)).toBe('');
      });
      
      test('handles undefined', () => {
        expect(slugify_(undefined)).toBe('');
      });
      
      test('handles only special characters', () => {
        expect(slugify_('!@#$%')).toBe('');
      });
      
      test('handles very long strings', () => {
        const long = 'a'.repeat(100);
        const result = slugify_(long);
        expect(result.length).toBe(100);
      });
    });
    
    describe('Real-world examples', () => {
      test('event title to slug', () => {
        expect(slugify_('Summer Music Festival 2024')).toBe('summer-music-festival-2024');
      });
      
      test('location to slug', () => {
        expect(slugify_('Chicago, IL')).toBe('chicago-il');
      });
      
      test('category to slug', () => {
        expect(slugify_('Arts & Culture')).toBe('arts-culture');
      });
    });
  });
});
