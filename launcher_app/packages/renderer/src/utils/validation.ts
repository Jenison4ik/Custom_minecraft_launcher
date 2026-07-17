// Validation utilities for the renderer process

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a Minecraft nickname
 * @param nickname The nickname to validate
 * @returns ValidationResult indicating if the nickname is valid
 */
export function validateNickname(nickname: string): ValidationResult {
  const errors: string[] = [];
  
  if (!nickname || nickname.trim().length === 0) {
    errors.push('Nickname cannot be empty');
  } else {
    const trimmedNick = nickname.trim();
    
    if (trimmedNick.length < 3) {
      errors.push('Nickname must be at least 3 characters long');
    }
    
    if (trimmedNick.length > 16) {
      errors.push('Nickname must be no more than 16 characters long');
    }
    
    // Check for invalid characters (alphanumeric and underscore/hyphen only)
    if (!/^[a-zA-Z0-9_\-]+$/.test(trimmedNick)) {
      errors.push('Nickname can only contain letters, numbers, underscores, and hyphens');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates RAM allocation
 * @param ram The RAM amount in MB
 * @param maxRam The maximum available RAM in MB
 * @returns ValidationResult indicating if the RAM allocation is valid
 */
export function validateRamAllocation(ram: number, maxRam: number): ValidationResult {
  const errors: string[] = [];
  
  if (isNaN(ram) || ram <= 0) {
    errors.push('RAM allocation must be a positive number');
  }
  
  if (ram > maxRam) {
    errors.push(`RAM allocation (${ram} MB) exceeds available system memory (${maxRam} MB)`);
  }
  
  // Recommend leaving at least 1GB for the OS
  if (maxRam - ram < 1024 && ram < maxRam) {
    errors.push('Please leave at least 1GB of RAM for the operating system');
  }
  
  // Minimum recommended RAM for Minecraft
  if (ram < 1024) {
    errors.push('Minecraft requires at least 1024MB of RAM for optimal performance');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}