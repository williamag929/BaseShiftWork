export interface KioskQuestion {
    kioskQuestionId: number;
    questionText: string;
    companyId: number;
    isActive: boolean;
    questionType: 'text' | 'yes_no' | 'multiple_choice';
    options?: string[];
    isRequired: boolean;
    displayOrder: number;
}

export interface CreateKioskQuestionDto {
    questionText: string;
    questionType: 'text' | 'yes_no' | 'multiple_choice';
    options?: string[];
    isRequired: boolean;
    isActive: boolean;
    displayOrder: number;
}

export interface UpdateKioskQuestionDto {
    questionText: string;
    questionType: 'text' | 'yes_no' | 'multiple_choice';
    options?: string[];
    isRequired: boolean;
    isActive: boolean;
    displayOrder: number;
}
