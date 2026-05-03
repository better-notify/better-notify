export type SlackPlainText = {
  type: 'plain_text';
  text: string;
  emoji?: boolean;
};

export type SlackMrkdwn = {
  type: 'mrkdwn';
  text: string;
  verbatim?: boolean;
};

export type SlackText = SlackPlainText | SlackMrkdwn;

export type SlackOption = {
  text: SlackText;
  value: string;
  description?: SlackPlainText;
};

export type SlackOptionGroup = {
  label: SlackPlainText;
  options: SlackOption[];
};

export type SlackConfirmDialog = {
  title: SlackPlainText;
  text: SlackText;
  confirm: SlackPlainText;
  deny: SlackPlainText;
  style?: 'primary' | 'danger';
};

export type SlackButtonElement = {
  type: 'button';
  text: SlackPlainText;
  action_id: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
  confirm?: SlackConfirmDialog;
};

export type SlackImageElement = {
  type: 'image';
  image_url: string;
  alt_text: string;
};

export type SlackOverflowElement = {
  type: 'overflow';
  action_id: string;
  options: SlackOption[];
  confirm?: SlackConfirmDialog;
};

export type SlackDatepickerElement = {
  type: 'datepicker';
  action_id: string;
  placeholder?: SlackPlainText;
  initial_date?: string;
  confirm?: SlackConfirmDialog;
};

export type SlackTimepickerElement = {
  type: 'timepicker';
  action_id: string;
  placeholder?: SlackPlainText;
  initial_time?: string;
  confirm?: SlackConfirmDialog;
};

export type SlackStaticSelectElement = {
  type: 'static_select';
  action_id: string;
  placeholder?: SlackPlainText;
  options: SlackOption[];
  option_groups?: SlackOptionGroup[];
  initial_option?: SlackOption;
  confirm?: SlackConfirmDialog;
};

export type SlackMultiStaticSelectElement = {
  type: 'multi_static_select';
  action_id: string;
  placeholder?: SlackPlainText;
  options: SlackOption[];
  option_groups?: SlackOptionGroup[];
  initial_options?: SlackOption[];
  max_selected_items?: number;
  confirm?: SlackConfirmDialog;
};

export type SlackCheckboxesElement = {
  type: 'checkboxes';
  action_id: string;
  options: SlackOption[];
  initial_options?: SlackOption[];
  confirm?: SlackConfirmDialog;
};

export type SlackRadioButtonsElement = {
  type: 'radio_buttons';
  action_id: string;
  options: SlackOption[];
  initial_option?: SlackOption;
  confirm?: SlackConfirmDialog;
};

export type SlackPlainTextInputElement = {
  type: 'plain_text_input';
  action_id: string;
  placeholder?: SlackPlainText;
  initial_value?: string;
  multiline?: boolean;
  min_length?: number;
  max_length?: number;
};

export type SlackNumberInputElement = {
  type: 'number_input';
  action_id: string;
  is_decimal_allowed: boolean;
  placeholder?: SlackPlainText;
  initial_value?: string;
  min_value?: string;
  max_value?: string;
};

export type SlackUrlInputElement = {
  type: 'url_text_input';
  action_id: string;
  placeholder?: SlackPlainText;
  initial_value?: string;
};

export type SlackEmailInputElement = {
  type: 'email_text_input';
  action_id: string;
  placeholder?: SlackPlainText;
  initial_value?: string;
};

export type SlackRichTextInputElement = {
  type: 'rich_text_input';
  action_id: string;
  placeholder?: SlackPlainText;
  initial_value?: Record<string, unknown>;
};

export type SlackInteractiveElement =
  | SlackButtonElement
  | SlackOverflowElement
  | SlackDatepickerElement
  | SlackTimepickerElement
  | SlackStaticSelectElement
  | SlackMultiStaticSelectElement
  | SlackCheckboxesElement
  | SlackRadioButtonsElement;

export type SlackInputElement =
  | SlackPlainTextInputElement
  | SlackNumberInputElement
  | SlackUrlInputElement
  | SlackEmailInputElement
  | SlackRichTextInputElement
  | SlackStaticSelectElement
  | SlackMultiStaticSelectElement
  | SlackCheckboxesElement
  | SlackRadioButtonsElement
  | SlackDatepickerElement
  | SlackTimepickerElement;

export type SlackAccessoryElement = SlackInteractiveElement | SlackImageElement;

export type SlackHeaderBlock = {
  type: 'header';
  text: SlackPlainText;
  block_id?: string;
};

export type SlackSectionBlock = {
  type: 'section';
  text?: SlackText;
  fields?: SlackText[];
  accessory?: SlackAccessoryElement;
  expand?: boolean;
  block_id?: string;
};

export type SlackImageBlock = {
  type: 'image';
  image_url: string;
  alt_text: string;
  title?: SlackPlainText;
  block_id?: string;
};

export type SlackVideoBlock = {
  type: 'video';
  alt_text: string;
  title: SlackPlainText;
  thumbnail_url: string;
  video_url: string;
  description?: SlackPlainText;
  title_url?: string;
  author_name?: string;
  provider_name?: string;
  provider_icon_url?: string;
  block_id?: string;
};

export type SlackDividerBlock = {
  type: 'divider';
  block_id?: string;
};

export type SlackActionsBlock = {
  type: 'actions';
  elements: SlackInteractiveElement[];
  block_id?: string;
};

export type SlackContextBlock = {
  type: 'context';
  elements: (SlackText | SlackImageElement)[];
  block_id?: string;
};

export type SlackInputBlock = {
  type: 'input';
  label: SlackPlainText;
  element: SlackInputElement;
  hint?: SlackPlainText;
  optional?: boolean;
  dispatch_action?: boolean;
  block_id?: string;
};

export type SlackFileBlock = {
  type: 'file';
  external_id: string;
  source: 'remote';
  block_id?: string;
};

export type SlackRichTextBlock = {
  type: 'rich_text';
  elements: Record<string, unknown>[];
  block_id?: string;
};

export type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackImageBlock
  | SlackVideoBlock
  | SlackDividerBlock
  | SlackActionsBlock
  | SlackContextBlock
  | SlackInputBlock
  | SlackFileBlock
  | SlackRichTextBlock;

export type SlackFile = {
  data: Buffer | Uint8Array;
  filename: string;
  title?: string;
  altText?: string;
};

export type SlackSendArgs<TInput = unknown> = {
  to?: string;
  threadTs?: string;
  input: TInput;
};

export type RenderedSlack = {
  text: string;
  to?: string;
  blocks?: SlackBlock[];
  threadTs?: string;
  file?: SlackFile;
};
