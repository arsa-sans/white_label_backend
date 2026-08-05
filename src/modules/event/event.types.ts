export interface CreateEventDto {
  name: string;
  description?: string;
  category?: string;
  location: string;
  venue_name?: string;
  start_date: string;
  end_date: string;
  capacity?: number;
  banner_url?: string;
  status?: 'draft' | 'published' | 'ended';
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
