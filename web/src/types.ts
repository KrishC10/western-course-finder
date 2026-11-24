// Shapes of the JSON files written by scraper/build_data.py.

/** A course id, or a group where every ("and") or any ("or") child must hold. */
export type Rule = string | { and: Rule[] } | { or: Rule[] };

export type ParseStatus = 'parsed' | 'partial' | 'unparsed' | 'none';

export interface Course {
  id: string;
  subject: string;
  subject_name: string;
  number: number;
  suffixes: string[];
  code: string;
  title: string;
  description: string;
  credit_weight: number;
  level: number;
  faculty: string;
  breadth: string[];
  prereq_text: string;
  prereq_rule: Rule | null;
  prereq_notes: string[];
  prereq_parse_status: ParseStatus;
  coreq_text: string;
  antireq_ids: string[];
  antireq_text: string;
  extra_info: string;
  url: string;
}

export interface Subject {
  code: string;
  name: string;
  faculty: string;
  aliases: string[];
}

export interface CoursesFile {
  generated: string;
  source: string;
  sample?: boolean;
  courses: Course[];
}

export type UnlocksFile = Record<string, string[]>;
