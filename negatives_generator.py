import random
import re

def parse_input(raw_input):
    """
    Parse input that may contain commas, semicolons, etc.
    For multi-line input, use 'multiline' command.
    
    Args:
        raw_input: Raw string input from user
        
    Returns:
        List of cleaned items
    """
    # Handle semicolons and normalize spacing
    normalized = re.sub(r'[;]+', ',', raw_input)  # Replace semicolons with commas
    normalized = re.sub(r'\s*,\s*', ',', normalized)  # Normalize comma spacing
    
    # Split on commas, trim, and discard any empty entries
    items = [item.strip() for item in normalized.split(",") if item.strip()]
    return items

def get_multiline_input():
    """
    Get multi-line input from user by prompting for each line.
    """
    print("Enter items one per line. Type 'END' on a new line when finished:")
    items = []
    while True:
        line = input().strip()
        if line.upper() == 'END':
            break
        if line:  # Only add non-empty lines
            items.append(line)
    return items

def generate_negated_list(input_items):
    """
    Generate negated versions of input items using randomized negative modifiers.
    
    Args:
        input_items: List of input items from user
        
    Returns:
        List of negated terms
    """
    negative_modifiers = ["not", "no", "un-"]
    negated_items = []
    
    for item in input_items:
        modifier = random.choice(negative_modifiers)
        negated_items.append(f"{modifier} {item}")
    
    return negated_items


def generate_bad_descriptor_list(input_items, descriptors):
    """
    Generate bad descriptor combinations with input items using randomized descriptors.
    
    Args:
        input_items: List of input items from user
        descriptors: List of "bad" descriptors to combine with items
        
    Returns:
        List of bad descriptor terms
    """
    # Shuffle descriptors for randomization
    shuffled_descriptors = descriptors.copy()
    random.shuffle(shuffled_descriptors)
    
    bad_terms = []
    desc_index = 0
    item_index = 0
    
    # Continue generating terms (we'll limit this in combine_lists)
    for i in range(len(shuffled_descriptors)):
        desc = shuffled_descriptors[desc_index % len(shuffled_descriptors)]
        item = input_items[item_index % len(input_items)]
        term = f"{desc} {item}"
        bad_terms.append(term)
        
        desc_index += 1
        item_index += 1
    
    return bad_terms


def combine_lists(negated_list, bad_list, length_limit, combination_type="negated_first"):
    """
    Combine negated and bad descriptor lists respecting length limit.
    
    Args:
        negated_list: List of negated terms
        bad_list: List of bad descriptor terms
        length_limit: Maximum character length for combined result
        combination_type: How to combine lists ("negated_first", "bad_first", "randomized")
        
    Returns:
        List of combined terms that fit within length limit
    """
    if combination_type == "negated_first":
        combined_terms = negated_list.copy()
        
        # Add bad terms one by one until we hit the length limit
        for bad_term in bad_list:
            # Calculate what the length would be with this new term
            test_list = combined_terms + [bad_term]
            test_string = ", ".join(test_list)
            
            if len(test_string) > length_limit:
                break
            
            combined_terms.append(bad_term)
    
    # Future: Add other combination types here
    # elif combination_type == "bad_first":
    # elif combination_type == "randomized":
    
    return combined_terms


def generate_positive_list(input_items, combined_negative_list):
    """
    Generate positive list by repeating original items to match negative list count.
    
    Args:
        input_items: List of original input items
        combined_negative_list: The combined negative list to match count of
        
    Returns:
        List of positive terms with same count as negative list
    """
    target_count = len(combined_negative_list)
    positive_terms = []
    
    for i in range(target_count):
        positive_terms.append(input_items[i % len(input_items)])
    
    return positive_terms


def build_versions(input_items, descriptors):
    """
    Build good and bad versions of the input items using modular approach.
    
    Args:
        input_items: List of input items from user
        descriptors: List of "bad" descriptors to combine with items
    """
    # Generate the component lists
    negated_list = generate_negated_list(input_items)
    bad_descriptor_list = generate_bad_descriptor_list(input_items, descriptors)
    
    # Combine lists respecting 1000 character limit
    combined_negative_list = combine_lists(negated_list, bad_descriptor_list, 1000, "negated_first")
    
    # Generate matching positive list
    positive_list = generate_positive_list(input_items, combined_negative_list)
    
    # Create final strings
    good_version = ", ".join(positive_list)
    bad_version = ", ".join(combined_negative_list)
    
    # Output
    print(f"\nGood version ({len(positive_list)} terms):")
    print(good_version)
    
    print(f"\nBad version ({len(combined_negative_list)} terms):")
    print(bad_version)


def main():
    # Define the list of "bad" descriptors (genres, etc.)
    raw_descs = """
    Horrorcore, Rockabilly, Soundtrack, kid's, children's, Christmas, holiday, jingle, oldies, Teen, Vocaloid, idol, K-Pop, mandarin, LGBT, Swing, Country, Anime, Black Metal, Straight Edge, Psychobilly, mediocre, Parody, humorous, Comedy, Reggaetón, Drill, Future Bass, Big Room House, Dubstep, Bounce, Hardstyle, Trance, Jersey Club, Footwork, Chiptune, Psytrance, Moombahton, Riddim Dubstep, Tech-House, Phonk, Electro-swing, Cumbia, Tango, Bossa Nova, Samba, Dancehall, Bhangra, Disco, Polka, Vaporwave, Minimal Techno, Blues, Sea Shanty, Lo-fi Hip-Hop, Synthwave, K-pop
    """
    
    # Split on commas and trim whitespace
    descriptors = [desc.strip() for desc in raw_descs.split(",") if desc.strip()]
    
    while True:
        # Prompt the user for a delimited list (or 'exit' to quit)
        raw_input = input("Enter a list (commas/semicolons), 'multiline' for line-by-line input, or 'exit' to quit: ")
        
        if raw_input.lower() == 'exit':
            break
        
        if raw_input.lower() == 'multiline':
            # Get multi-line input
            items = get_multiline_input()
        else:
            # Parse input handling multiple delimiter types
            items = parse_input(raw_input)
        
        if len(items) == 0:
            print("No non-empty items found. Please enter a valid list.")
            continue
        
        # Build and display the standard (clean) Good/Bad versions
        build_versions(items, descriptors)
        
        # Ask if the user wants a randomized reorder
        choice = input("\nType 'random' to shuffle items & rebuild Good/Bad versions, or press Enter to continue: ")
        
        if choice.lower() == "random":
            # Shuffle the original items
            shuffled_items = items.copy()
            random.shuffle(shuffled_items)
            print("\n-- Randomized Output --")
            build_versions(shuffled_items, descriptors)
        
        print()


if __name__ == "__main__":
    main()
