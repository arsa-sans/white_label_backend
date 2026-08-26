export interface CreateEventDto {
  name: string;
  description?: string;
  category?: string;
  location: string;
  venue_name?: string;
  venue_layout_info?: string;
  start_date: string;
  end_date: string;
  capacity?: number;
  banner_url?: string;
  status?: 'draft' | 'published' | 'ended';
  guest_stars?: Array<{ name: string; photo_url: string; role: string }>;
  venue_map_url?: string;
  poster_url?: string;
  terms_conditions?: string;
}

export interface UpdateEventDto extends Partial<CreateEventDto> {}

export interface UpsertSeatCategoryDto {
  catId?: string;
  name: string;
  price: number;
  rows: string[];
  cols: number;
  color?: string;
}

export interface EventListQuery {
  category?: string;
  search?: string;
  status?: string;
  min_price?: string;
  max_price?: string;
  page?: string;
  limit?: string;
}

export interface EventSessionDto {
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateEventSessionDto extends Partial<EventSessionDto> {}
