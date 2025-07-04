import { z } from 'zod';

export interface ActionSchema {
  name: string;
  description: string;
  schema: z.ZodType;
}

export const doneActionSchema: ActionSchema = {
  name: 'done',
  description: 'Complete task',
  schema: z.object({
    text: z.string(),
    success: z.boolean(),
  }),
};

// Basic Navigation Actions
export const searchGoogleActionSchema: ActionSchema = {
  name: 'search_google',
  description:
    'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    query: z.string(),
  }),
};

export const goToUrlActionSchema: ActionSchema = {
  name: 'go_to_url',
  description: 'Navigate to URL in the current tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string(),
  }),
};

export const goBackActionSchema: ActionSchema = {
  name: 'go_back',
  description: 'Go back to the previous page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
  }),
};

export const clickElementActionSchema: ActionSchema = {
  name: 'click_element',
  description: 'Click element by index',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const inputTextActionSchema: ActionSchema = {
  name: 'input_text',
  description: 'Input text into an interactive input element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    text: z.string().describe('text to input'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Tab Management Actions
export const switchTabActionSchema: ActionSchema = {
  name: 'switch_tab',
  description: 'Switch to tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab to switch to'),
  }),
};

export const openTabActionSchema: ActionSchema = {
  name: 'open_tab',
  description: 'Open URL in new tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string().describe('url to open'),
  }),
};

export const closeTabActionSchema: ActionSchema = {
  name: 'close_tab',
  description: 'Close tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab'),
  }),
};

// Content Actions, not used currently
// export const extractContentActionSchema: ActionSchema = {
//   name: 'extract_content',
//   description:
//     'Extract page content to retrieve specific information from the page, e.g. all company names, a specific description, all information about, links with companies in structured format or simply links',
//   schema: z.object({
//     goal: z.string(),
//   }),
// };

// Cache Actions
export const cacheContentActionSchema: ActionSchema = {
  name: 'cache_content',
  description: 'Cache what you have found so far from the current page for future use',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    content: z.string().describe('content to cache'),
  }),
};

export const scrollDownActionSchema: ActionSchema = {
  name: 'scroll_down',
  description: 'Scroll down the page by pixel amount - if no amount is specified, scroll down one page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    amount: z.number().int().nullable().optional().describe('amount of pixels'),
  }),
};

export const scrollUpActionSchema: ActionSchema = {
  name: 'scroll_up',
  description: 'Scroll up the page by pixel amount - if no amount is specified, scroll up one page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    amount: z.number().int().nullable().optional().describe('amount of pixels'),
  }),
};

export const sendKeysActionSchema: ActionSchema = {
  name: 'send_keys',
  description:
    'Send strings of special keys like Backspace, Insert, PageDown, Delete, Enter. Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard press. Be aware of different operating systems and their shortcuts',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    keys: z.string().describe('keys to send'),
  }),
};

export const scrollToTextActionSchema: ActionSchema = {
  name: 'scroll_to_text',
  description: 'If you dont find something which you want to interact with, scroll to it',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    text: z.string().describe('text to scroll to'),
  }),
};

export const scrollElementActionSchema: ActionSchema = {
  name: 'scroll_element',
  description: 'Scroll a specific element (like a modal or a scrollable div) up or down.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    elementId: z.number().describe('The index of the scrollable element to scroll.'),
    direction: z.enum(['up', 'down']).describe("The direction to scroll ('up' or 'down')."),
    reasoning: z.string().optional().describe('Reasoning for scrolling this element.'),
  }),
};

export const getDropdownOptionsActionSchema: ActionSchema = {
  name: 'get_dropdown_options',
  description: 'Get all options from a native dropdown',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
  }),
};

export const selectDropdownOptionActionSchema: ActionSchema = {
  name: 'select_dropdown_option',
  description: 'Select dropdown option for interactive element index by the text of the option you want to select',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
    text: z.string().describe('text of the option'),
  }),
};

export const waitActionSchema: ActionSchema = {
  name: 'wait',
  description: 'Wait for x seconds default 3, do NOT use this action unless user asks to wait explicitly',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    seconds: z.number().int().default(3).describe('amount of seconds'),
  }),
};
